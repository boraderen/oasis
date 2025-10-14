"""Conformance router for conformance checking operations."""
from fastapi import APIRouter, Form
import pandas as pd
import pm4py
import json
import os

from models import state
from utils.helpers import footprint_to_matrix, count_footprint_differences

router = APIRouter()


@router.post("/api/conformance_log_log")
async def conformance_log_log(log_index_1: int = Form(...), log_index_2: int = Form(...)):
    """Perform footprint-based conformance checking between two logs"""
    try:
        # Validate log indices
        if log_index_1 < 0 or log_index_1 >= len(state.logs):
            return {"message": f"Invalid first log index: {log_index_1}", "status": "error"}
        if log_index_2 < 0 or log_index_2 >= len(state.logs):
            return {"message": f"Invalid second log index: {log_index_2}", "status": "error"}
        
        # Get the logs
        log1 = state.logs[log_index_1]["log_object"]
        log2 = state.logs[log_index_2]["log_object"]
        log1_metadata = state.logs[log_index_1]["metadata"]
        log2_metadata = state.logs[log_index_2]["metadata"]
        
        # Get log statistics
        num_events_1 = len(log1)
        num_cases_1 = len(log1['case:concept:name'].unique())
        num_events_2 = len(log2)
        num_cases_2 = len(log2['case:concept:name'].unique())
        
        # Discover footprints for both logs
        footprints1 = pm4py.discover_footprints(log1)
        footprints2 = pm4py.discover_footprints(log2)
        
        footprint1_matrix = footprint_to_matrix(footprints1)
        footprint2_matrix = footprint_to_matrix(footprints2)
        
        # Calculate number of different cells
        num_different_cells = count_footprint_differences(footprints1, footprints2)
        
        # Calculate footprint conformance
        num_activities = max(len(footprint1_matrix['activities']), len(footprint2_matrix['activities']))
        total_cells = num_activities * num_activities
        footprint_conformance = 1.0 - (num_different_cells / total_cells) if total_cells > 0 else 0.0
        
        # Generate DFGs for visualization
        dfg1, sa1, ea1 = pm4py.discover_dfg(log1)
        pm4py.save_vis_dfg(dfg1, sa1, ea1, 'log1_dfg.svg')
        with open('log1_dfg.svg', 'r', encoding='utf-8') as f:
            log1_svg = f.read()
        os.unlink('log1_dfg.svg')
        
        dfg2, sa2, ea2 = pm4py.discover_dfg(log2)
        pm4py.save_vis_dfg(dfg2, sa2, ea2, 'log2_dfg.svg')
        with open('log2_dfg.svg', 'r', encoding='utf-8') as f:
            log2_svg = f.read()
        os.unlink('log2_dfg.svg')
        
        return {
            "message": "Log-Log conformance checking completed",
            "log1_metadata": log1_metadata,
            "log2_metadata": log2_metadata,
            "num_events_1": num_events_1,
            "num_cases_1": num_cases_1,
            "num_events_2": num_events_2,
            "num_cases_2": num_cases_2,
            "footprint1_matrix": footprint1_matrix,
            "footprint2_matrix": footprint2_matrix,
            "num_different_cells": num_different_cells,
            "footprint_conformance": footprint_conformance,
            "log1_svg": log1_svg,
            "log2_svg": log2_svg,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in log-log conformance checking: {str(e)}",
            "status": "error"
        }


@router.post("/api/conformance_log_model")
async def conformance_log_model(log_index: int = Form(...), model_index: int = Form(...)):
    """Perform conformance checking between log and model"""
    try:
        # Validate indices
        if log_index < 0 or log_index >= len(state.logs):
            return {"message": f"Invalid log index: {log_index}", "status": "error"}
        if model_index < 0 or model_index >= len(state.models):
            return {"message": f"Invalid model index: {model_index}", "status": "error"}
        
        # Get the log and model
        log = state.logs[log_index]["log_object"]
        log_metadata = state.logs[log_index]["metadata"]
        uploaded_model = state.models[model_index]["model_object"]
        model_metadata = state.models[model_index]["metadata"]
        
        # Convert BPMN to Petri net if needed
        if isinstance(uploaded_model, tuple) and len(uploaded_model) == 3:
            net, im, fm = uploaded_model
        else:
            net, im, fm = pm4py.convert_to_petri_net(uploaded_model)
        
        # Calculate token-based replay metrics
        tbr_fit = pm4py.fitness_token_based_replay(log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(log, net, im, fm)
        
        # Try to calculate alignment metrics
        try:
            align_fit = pm4py.fitness_alignments(log, net, im, fm)
            align_prec = pm4py.precision_alignments(log, net, im, fm)
            align_fitness_value = align_fit['log_fitness']
            align_precision_value = align_prec
            alignment_available = True
        except Exception:
            align_fitness_value = "PN not sound"
            align_precision_value = "PN not sound"
            alignment_available = False
        
        # Discover footprints for log and model
        log_footprints = pm4py.discover_footprints(log)
        model_footprints = pm4py.discover_footprints(net, im, fm)
        
        log_footprint_matrix = footprint_to_matrix(log_footprints)
        model_footprint_matrix = footprint_to_matrix(model_footprints)
        
        # Calculate number of different cells
        num_different_cells = count_footprint_differences(log_footprints, model_footprints)
        
        # Calculate metrics
        tbr_fitness = tbr_fit['log_fitness']
        tbr_precision = tbr_prec
        tbr_f1 = 2 * (tbr_fitness * tbr_precision) / (tbr_fitness + tbr_precision) if (tbr_fitness + tbr_precision) > 0 else 0
        
        if alignment_available:
            align_f1 = 2 * (align_fitness_value * align_precision_value) / (align_fitness_value + align_precision_value) if (align_fitness_value + align_precision_value) > 0 else 0
            mean_fitness = (tbr_fitness + align_fitness_value) / 2
            mean_precision = (tbr_precision + align_precision_value) / 2
        else:
            align_f1 = "PN not sound"
            mean_fitness = tbr_fitness
            mean_precision = tbr_precision
        
        # Calculate simplicity
        num_activities = len(log['concept:name'].unique())
        num_events = len(log)
        num_cases = len(log['case:concept:name'].unique())
        num_transitions = len(net.transitions)
        num_places = len(net.places)
        num_arcs = len(net.arcs)
        
        if num_transitions > 0:
            activity_transition_ratio = num_activities / num_transitions
            complexity_factor = (num_places + num_arcs) / (num_events + num_cases)
            simplicity = activity_transition_ratio * (1 / (1 + complexity_factor))
        else:
            simplicity = 0
        
        # Get alignments for trace variants (efficient approach)
        variants = pm4py.get_variants(log)
        
        try:
            # Get one trace per variant
            variant_traces = []
            for case_group in log.groupby('case:concept:name', sort=False):
                case_id = case_group[0]
                case_events = case_group[1]
                variant_tuple = tuple(case_events['concept:name'].tolist())
                
                # If this variant hasn't been added yet, add this case
                if variant_tuple not in [v for v, _ in variant_traces]:
                    variant_traces.append((variant_tuple, case_events))
            
            # Create a log with only one trace per variant
            variant_log_df = pd.concat([case_events for _, case_events in variant_traces], ignore_index=True)
            variant_log = pm4py.convert_to_event_log(variant_log_df)
            
            # Get alignments for the variant log (only unique variants)
            alignments = pm4py.conformance.conformance_diagnostics_alignments(variant_log, net, im, fm)
            
            # Build result for top 20 variants (sorted by frequency)
            sorted_variants = sorted(variants.items(), key=lambda x: x[1], reverse=True)[:20]
            
            alignment_data = []
            for idx, (variant, count) in enumerate(sorted_variants):
                variant_key = variant if isinstance(variant, tuple) else tuple(variant.split(','))
                
                if idx < len(alignments):
                    alignment_data.append({
                        'variant': list(variant_key),
                        'frequency': count,
                        'alignment': alignments[idx]['alignment'],
                        'fitness': alignments[idx]['fitness']
                    })
            
        except Exception as align_error:
            alignment_data = []
            print(f"Error computing alignments: {str(align_error)}")
            import traceback
            traceback.print_exc()
        
        print(f"Alignment data computed: {len(alignment_data)} variants")
        
        # Get TBR (Token-Based Replay) diagnostics for trace variants
        try:
            # Use the same variant log for TBR
            tbr_results = pm4py.conformance_diagnostics_token_based_replay(variant_log, net, im, fm)
            
            # Build TBR data for top 20 variants (sorted by frequency)
            sorted_variants = sorted(variants.items(), key=lambda x: x[1], reverse=True)[:20]
            
            tbr_data = []
            for idx, (variant, count) in enumerate(sorted_variants):
                variant_key = variant if isinstance(variant, tuple) else tuple(variant.split(','))
                
                if idx < len(tbr_results):
                    tbr_data.append({
                        'variant': list(variant_key),
                        'frequency': count,
                        'missing_tokens': tbr_results[idx].get('missing_tokens', 0),
                        'consumed_tokens': tbr_results[idx].get('consumed_tokens', 0),
                        'remaining_tokens': tbr_results[idx].get('remaining_tokens', 0),
                        'produced_tokens': tbr_results[idx].get('produced_tokens', 0),
                        'trace_is_fit': tbr_results[idx].get('trace_is_fit', False),
                        'trace_fitness': tbr_results[idx].get('trace_fitness', 0.0)
                    })
            
        except Exception as tbr_error:
            tbr_data = []
            print(f"Error computing TBR: {str(tbr_error)}")
            import traceback
            traceback.print_exc()
        
        print(f"TBR data computed: {len(tbr_data)} variants")
        
        # Generate visualizations
        pm4py.save_vis_petri_net(net, im, fm, 'model.svg')
        with open('model.svg', 'r', encoding='utf-8') as f:
            model_svg = f.read()
        os.unlink('model.svg')
        
        dfg, sa, ea = pm4py.discover_dfg(log)
        pm4py.save_vis_dfg(dfg, sa, ea, 'log_dfg.svg')
        with open('log_dfg.svg', 'r', encoding='utf-8') as f:
            log_svg = f.read()
        os.unlink('log_dfg.svg')
        
        # Calculate footprint conformance
        num_activities = len(model_footprint_matrix['activities'])
        total_cells = num_activities * num_activities
        footprint_conformance = 1.0 - (num_different_cells / total_cells) if total_cells > 0 else 0.0
        
        # Calculate mean values
        mean_fitness_combined = (tbr_fitness + align_fitness_value) / 2 if isinstance(align_fitness_value, (int, float)) else tbr_fitness
        mean_precision_combined = (tbr_precision + align_precision_value) / 2 if isinstance(align_precision_value, (int, float)) else tbr_precision
        mean_f1_combined = (tbr_f1 + align_f1) / 2 if isinstance(align_f1, (int, float)) else tbr_f1
        
        return {
            "message": "Log-Model conformance checking completed",
            "log_metadata": log_metadata,
            "model_metadata": model_metadata,
            "num_events": num_events,
            "num_cases": num_cases,
            "num_places": num_places,
            "num_transitions": num_transitions,
            "num_arcs": num_arcs,
            "log_footprint_matrix": log_footprint_matrix,
            "model_footprint_matrix": model_footprint_matrix,
            "num_different_cells": num_different_cells,
            "footprint_conformance": footprint_conformance,
            "alignment_data": alignment_data,
            "tbr_data": tbr_data,
            "model_svg": model_svg,
            "log_svg": log_svg,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "mean_fitness_combined": mean_fitness_combined,
            "mean_precision_combined": mean_precision_combined,
            "mean_f1_combined": mean_f1_combined,
            "simplicity": simplicity,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in log-model conformance checking: {str(e)}",
            "status": "error"
        }


@router.post("/api/compute_custom_alignment")
async def compute_custom_alignment(
    log_index: int = Form(...),
    model_index: int = Form(...),
    trace_activities: str = Form(...)
):
    """Compute alignment for a custom trace"""
    try:
        # Validate indices
        if log_index < 0 or log_index >= len(state.logs):
            return {"message": f"Invalid log index: {log_index}", "status": "error"}
        if model_index < 0 or model_index >= len(state.models):
            return {"message": f"Invalid model index: {model_index}", "status": "error"}
        
        # Parse the trace activities
        activities = json.loads(trace_activities)
        
        if not activities or len(activities) == 0:
            return {"message": "Please provide at least one activity", "status": "error"}
        
        # Get the original log and model
        original_log = state.logs[log_index]["log_object"]
        uploaded_model = state.models[model_index]["model_object"]
        
        # Convert BPMN to Petri net if needed
        if isinstance(uploaded_model, tuple) and len(uploaded_model) == 3:
            net, im, fm = uploaded_model
        else:
            net, im, fm = pm4py.convert_to_petri_net(uploaded_model)
        
        # Create a synthetic log with the custom trace
        # Use the first event from the original log as a template for timestamps
        first_event = original_log.iloc[0]
        
        events = []
        for i, activity in enumerate(activities):
            event = {
                'case:concept:name': 'custom_trace',
                'concept:name': activity,
                'time:timestamp': pd.Timestamp.now() + pd.Timedelta(seconds=i)
            }
            # Add resource if available in original log
            if 'org:resource' in original_log.columns:
                event['org:resource'] = 'custom_user'
            events.append(event)
        
        custom_log_df = pd.DataFrame(events)
        custom_log = pm4py.convert_to_event_log(custom_log_df)
        
        # Compute alignment
        alignments = pm4py.conformance.conformance_diagnostics_alignments(custom_log, net, im, fm)
        
        # Compute TBR
        tbr_results = pm4py.conformance_diagnostics_token_based_replay(custom_log, net, im, fm)
        
        if len(alignments) > 0 and len(tbr_results) > 0:
            return {
                "message": "Custom alignment computed successfully",
                "alignment": alignments[0]['alignment'],
                "fitness": alignments[0]['fitness'],
                "tbr": {
                    'missing_tokens': tbr_results[0].get('missing_tokens', 0),
                    'consumed_tokens': tbr_results[0].get('consumed_tokens', 0),
                    'remaining_tokens': tbr_results[0].get('remaining_tokens', 0),
                    'produced_tokens': tbr_results[0].get('produced_tokens', 0),
                    'trace_is_fit': tbr_results[0].get('trace_is_fit', False),
                    'trace_fitness': tbr_results[0].get('trace_fitness', 0.0)
                },
                "status": "success"
            }
        else:
            return {
                "message": "Failed to compute alignment",
                "status": "error"
            }
        
    except Exception as e:
        return {
            "message": f"Error computing custom alignment: {str(e)}",
            "status": "error"
        }


@router.post("/api/conformance_model_model")
async def conformance_model_model(model_index_1: int = Form(...), model_index_2: int = Form(...)):
    """Perform footprint-based conformance checking between two models"""
    try:
        # Validate model indices
        if model_index_1 < 0 or model_index_1 >= len(state.models):
            return {"message": f"Invalid first model index: {model_index_1}", "status": "error"}
        if model_index_2 < 0 or model_index_2 >= len(state.models):
            return {"message": f"Invalid second model index: {model_index_2}", "status": "error"}
        
        # Get the models
        model1 = state.models[model_index_1]["model_object"]
        model2 = state.models[model_index_2]["model_object"]
        model1_metadata = state.models[model_index_1]["metadata"]
        model2_metadata = state.models[model_index_2]["metadata"]
        
        # Convert BPMN to Petri net if needed
        if isinstance(model1, tuple) and len(model1) == 3:
            net1, im1, fm1 = model1
        else:
            net1, im1, fm1 = pm4py.convert_to_petri_net(model1)
        
        if isinstance(model2, tuple) and len(model2) == 3:
            net2, im2, fm2 = model2
        else:
            net2, im2, fm2 = pm4py.convert_to_petri_net(model2)
        
        # Get Petri net statistics
        num_places_1 = len(net1.places)
        num_transitions_1 = len(net1.transitions)
        num_arcs_1 = len(net1.arcs)
        
        num_places_2 = len(net2.places)
        num_transitions_2 = len(net2.transitions)
        num_arcs_2 = len(net2.arcs)
        
        # Discover footprints for both models
        footprints1 = pm4py.discover_footprints(net1, im1, fm1)
        footprints2 = pm4py.discover_footprints(net2, im2, fm2)
        
        footprint1_matrix = footprint_to_matrix(footprints1)
        footprint2_matrix = footprint_to_matrix(footprints2)
        
        # Calculate number of different cells
        num_different_cells = count_footprint_differences(footprints1, footprints2)
        
        # Calculate footprint conformance
        num_activities = max(len(footprint1_matrix['activities']), len(footprint2_matrix['activities']))
        total_cells = num_activities * num_activities
        footprint_conformance = 1.0 - (num_different_cells / total_cells) if total_cells > 0 else 0.0
        
        # Generate visualizations
        pm4py.save_vis_petri_net(net1, im1, fm1, 'model1.svg')
        with open('model1.svg', 'r', encoding='utf-8') as f:
            model1_svg = f.read()
        os.unlink('model1.svg')
        
        pm4py.save_vis_petri_net(net2, im2, fm2, 'model2.svg')
        with open('model2.svg', 'r', encoding='utf-8') as f:
            model2_svg = f.read()
        os.unlink('model2.svg')
        
        return {
            "message": "Model-Model conformance checking completed",
            "model1_metadata": model1_metadata,
            "model2_metadata": model2_metadata,
            "model1_svg": model1_svg,
            "model2_svg": model2_svg,
            "num_places_1": num_places_1,
            "num_transitions_1": num_transitions_1,
            "num_arcs_1": num_arcs_1,
            "num_places_2": num_places_2,
            "num_transitions_2": num_transitions_2,
            "num_arcs_2": num_arcs_2,
            "footprint1_matrix": footprint1_matrix,
            "footprint2_matrix": footprint2_matrix,
            "num_different_cells": num_different_cells,
            "footprint_conformance": footprint_conformance,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in model-model conformance checking: {str(e)}",
            "status": "error"
        }

