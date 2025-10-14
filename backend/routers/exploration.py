"""Exploration router for DFG discovery and log visualization."""
from fastapi import APIRouter, Form
import pm4py
import json
import os
import pandas as pd
from datetime import datetime

from models import state
from utils.helpers import get_log_insights, footprint_to_matrix

router = APIRouter()


def convert_value_to_serializable(value):
    """Convert any value to JSON-serializable format, handling dates properly"""
    if pd.isna(value):
        return ''
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.isoformat()
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    
    # Check if string looks like an ISO datetime (e.g., "2011-10-01T02:38:00+00:00")
    str_value = str(value)
    if isinstance(value, str) and 'T' in str_value and (':' in str_value):
        try:
            # Try to parse as datetime to validate
            parsed = pd.to_datetime(str_value)
            if pd.notna(parsed):
                return parsed.isoformat()
        except:
            pass
    
    return str_value


@router.post("/api/explore/{log_index}")
async def explore(log_index: int):
    """Explore a specific log - discover DFG and get statistics"""
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(state.logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the log entry
        log_entry = state.logs[log_index]
        event_log = log_entry["log_object"]
        log_metadata = log_entry["metadata"]
        
        # Get original columns from metadata (captured at upload time)
        # This excludes PM4Py-added columns like start_timestamp
        if "original_columns" in log_metadata:
            original_columns = log_metadata["original_columns"]
        else:
            # Fallback for old uploaded logs: filter out PM4Py-added start_timestamp
            original_columns = []
            for col in event_log.columns:
                # Exclude start_timestamp if it equals time:timestamp (PM4Py added it)
                if col == 'start_timestamp' and 'time:timestamp' in event_log.columns:
                    try:
                        if event_log['start_timestamp'].equals(event_log['time:timestamp']):
                            continue  # Skip this PM4Py-added column
                    except:
                        pass
                original_columns.append(col)
        
        # Discover regular DFG components
        dfg, sa, ea = pm4py.discover_dfg(event_log)
        
        # Generate regular DFG visualization
        pm4py.save_vis_dfg(dfg, sa, ea, 'dfg.svg')
        
        # Read the regular DFG SVG content
        with open('dfg.svg', 'r', encoding='utf-8') as svg_file:
            regular_svg_content = svg_file.read()
        
        # Delete the temporary regular DFG SVG file
        os.unlink('dfg.svg')
        
        # Discover performance DFG
        perf_dfg, perf_sa, perf_ea = pm4py.discover_performance_dfg(event_log)
        
        # Generate performance DFG visualization
        pm4py.save_vis_performance_dfg(perf_dfg, perf_sa, perf_ea, 'perf_dfg.svg')
        
        # Read the performance DFG SVG content
        with open('perf_dfg.svg', 'r', encoding='utf-8') as svg_file:
            performance_svg_content = svg_file.read()
        
        # Delete the temporary performance DFG SVG file
        os.unlink('perf_dfg.svg')
        
        # Get log insights and statistics
        insights = get_log_insights(event_log)
        
        # Get all unique activities and variants for filtering controls
        activities = list(event_log['concept:name'].unique())
        variants = pm4py.get_variants(event_log)
        variant_list = []
        for variant, count in list(variants.items())[:20]:  # Limit to top 20 variants
            if isinstance(variant, tuple):
                variant_list.append({
                    "activities": list(variant),
                    "frequency": count
                })
        
        # Generate visualization charts
        # 1. Dotted chart
        pm4py.save_vis_dotted_chart(event_log, 'dotted_chart.svg', show_legend=False)
        with open('dotted_chart.svg', 'r', encoding='utf-8') as f:
            dotted_chart_svg = f.read()
        os.unlink('dotted_chart.svg')
        
        # 2. Case duration graph
        pm4py.save_vis_case_duration_graph(event_log, 'case_duration.svg')
        with open('case_duration.svg', 'r', encoding='utf-8') as f:
            case_duration_svg = f.read()
        os.unlink('case_duration.svg')
        
        # 3. Events per time graph
        pm4py.save_vis_events_per_time_graph(event_log, 'events_per_time.svg')
        with open('events_per_time.svg', 'r', encoding='utf-8') as f:
            events_per_time_svg = f.read()
        os.unlink('events_per_time.svg')
        
        # 4. Event distribution graph (default: days_week)
        pm4py.save_vis_events_distribution_graph(event_log, 'event_distribution.svg', distr_type='days_week')
        with open('event_distribution.svg', 'r', encoding='utf-8') as f:
            event_distribution_svg = f.read()
        os.unlink('event_distribution.svg')
        
        # Get first 20 events as table data with ONLY original columns
        first_20_events = []
        for idx, row in event_log.head(20).iterrows():
            event_dict = {}
            # Add only the original columns (exclude PM4Py-added columns)
            for col in original_columns:
                value = row.get(col, '')
                event_dict[col] = convert_value_to_serializable(value)
            first_20_events.append(event_dict)
        
        # Use original column names for the table
        event_columns = original_columns
        
        # Discover footprint matrix for the log
        log_footprints = pm4py.discover_footprints(event_log)
        footprint_matrix = footprint_to_matrix(log_footprints)
        
        return {
            "message": "Exploration completed successfully",
            "regular_svg_content": regular_svg_content,
            "performance_svg_content": performance_svg_content,
            "insights": insights,
            "log_metadata": log_metadata,
            "available_activities": activities,
            "available_variants": variant_list,
            "dotted_chart_svg": dotted_chart_svg,
            "case_duration_svg": case_duration_svg,
            "events_per_time_svg": events_per_time_svg,
            "event_distribution_svg": event_distribution_svg,
            "first_20_events": first_20_events,
            "event_columns": event_columns,
            "footprint_matrix": footprint_matrix,
            "status": "success"
        }
    except Exception as e:
        return {
            "message": f"Error exploring log: {str(e)}",
            "status": "error"
        }


@router.post("/api/update_dfg")
async def update_dfg(
    log_index: int = Form(...),
    selected_activities: str = Form("[]"),
    selected_variants: str = Form("[]")
):
    """Update DFG by filtering log and re-discovering DFG"""
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(state.logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the original log
        event_log = state.logs[log_index]["log_object"]
        
        # Parse selected activities and variants
        selected_activities_list = json.loads(selected_activities)
        selected_variants_list = json.loads(selected_variants)
        
        # Apply filters to the log
        filtered_log = event_log
        
        # STEP 1: Filter by selected activities FIRST if any are specified
        if selected_activities_list and len(selected_activities_list) > 0:
            filtered_log = pm4py.filter_event_attribute_values(
                filtered_log, 
                'concept:name', 
                selected_activities_list, 
                level='event'
            )
        
        # STEP 2: Pre-filter variants: remove activities not in selected_activities_list from variant traces
        if selected_activities_list and len(selected_activities_list) > 0:
            # Filter out activities not in selected_activities_list from each variant
            filtered_variants = []
            for variant in selected_variants_list:
                filtered_variant = [activity for activity in variant if activity in selected_activities_list]
                if len(filtered_variant) > 0:  # Only keep variants that still have activities
                    filtered_variants.append(filtered_variant)
            selected_variants_list = filtered_variants
        
        # STEP 3: Filter by selected variants using the pre-filtered variants
        if selected_variants_list and len(selected_variants_list) > 0:
            # Convert variant list to tuples for pm4py
            variant_tuples = [tuple(variant) for variant in selected_variants_list]
            filtered_log = pm4py.filter_variants(filtered_log, variant_tuples)
        
        # Re-discover regular DFG from filtered log
        new_dfg, new_sa, new_ea = pm4py.discover_dfg(filtered_log)
        
        # Generate regular DFG visualization
        pm4py.save_vis_dfg(new_dfg, new_sa, new_ea, 'dfg.svg')
        
        # Read the regular DFG SVG content
        with open('dfg.svg', 'r', encoding='utf-8') as svg_file:
            regular_svg_content = svg_file.read()
        
        # Delete the temporary regular DFG SVG file
        os.unlink('dfg.svg')
        
        # Discover performance DFG from filtered log
        perf_dfg, perf_sa, perf_ea = pm4py.discover_performance_dfg(filtered_log)
        
        # Generate performance DFG visualization
        pm4py.save_vis_performance_dfg(perf_dfg, perf_sa, perf_ea, 'perf_dfg.svg')
        
        # Read the performance DFG SVG content
        with open('perf_dfg.svg', 'r', encoding='utf-8') as svg_file:
            performance_svg_content = svg_file.read()
        
        # Delete the temporary performance DFG SVG file
        os.unlink('perf_dfg.svg')
        
        return {
            "message": f"DFG updated with filters",
            "regular_svg_content": regular_svg_content,
            "performance_svg_content": performance_svg_content,
            "status": "success"
        }
    except Exception as e:
        return {
            "message": "Please make filterings such that the resulting DFG is not empty",
            "status": "error"
        }


@router.post("/api/update_event_distribution_graph")
async def update_event_distribution_graph(
    log_index: int = Form(...),
    distr_type: str = Form("days_week")
):
    """Update event distribution graph with selected distribution type"""
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(state.logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the log
        event_log = state.logs[log_index]["log_object"]
        
        # Validate distribution type
        valid_types = ['days_month', 'months', 'years', 'hours', 'days_week', 'weeks']
        if distr_type not in valid_types:
            return {
                "message": f"Invalid distribution type. Must be one of: {', '.join(valid_types)}",
                "status": "error"
            }
        
        # Generate event distribution graph with selected type
        pm4py.save_vis_events_distribution_graph(event_log, 'event_distribution.svg', distr_type=distr_type)
        with open('event_distribution.svg', 'r', encoding='utf-8') as f:
            event_distribution_svg = f.read()
        os.unlink('event_distribution.svg')
        
        return {
            "message": f"Event distribution graph updated with type: {distr_type}",
            "event_distribution_svg": event_distribution_svg,
            "status": "success"
        }
    except Exception as e:
        return {
            "message": f"Error updating event distribution graph: {str(e)}",
            "status": "error"
        }

