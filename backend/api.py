from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import pandas as pd
import pm4py
import json
import tempfile
import os

app = FastAPI(title="Oasis API", version="1.0.0")

# ============================================================================
# GLOBAL VARIABLES
# ============================================================================

# Store lists of uploaded logs and models
# Each log entry contains: {"metadata": {...}, "log_object": ...}
logs = []
models = []

# Global variable for the currently active model (used by conformance)
model = None

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_log_insights(event_log):
    """Extract insights and statistics from the event log"""
    try:
        import statistics
        
        # Basic statistics
        num_events = len(event_log)
        num_cases = len(event_log['case:concept:name'].unique())
        
        # Get activity information using correct PM4Py function
        activity_frequencies = pm4py.get_event_attribute_values(event_log, "concept:name")
        num_activities = len(activity_frequencies)
        
        # Calculate how many cases each activity appears in
        activity_case_counts = {}
        for activity in activity_frequencies.keys():
            # Count unique cases that contain this activity
            cases_with_activity = event_log[event_log['concept:name'] == activity]['case:concept:name'].nunique()
            activity_case_counts[activity] = cases_with_activity
        
        # Check if start timestamp exists
        has_start_timestamp = 'start_timestamp' in pm4py.get_event_attributes(event_log)
        
        # Calculate activity durations
        activity_durations = {}
        if has_start_timestamp:
            for activity in activity_frequencies.keys():
                activity_events = event_log[event_log['concept:name'] == activity]
                durations = []
                for idx, event in activity_events.iterrows():
                    if 'start_timestamp' in event and 'time:timestamp' in event:
                        duration = (event['time:timestamp'] - event['start_timestamp']).total_seconds()
                        if duration >= 0:
                            durations.append(duration)
                
                if durations:
                    activity_durations[activity] = {
                        "avg": round(statistics.mean(durations), 2),
                        "min": round(min(durations), 2),
                        "max": round(max(durations), 2),
                        "median": round(statistics.median(durations), 2)
                    }
                else:
                    activity_durations[activity] = {"avg": 0, "min": 0, "max": 0, "median": 0}
        else:
            # No start timestamps, set all to 0
            for activity in activity_frequencies.keys():
                activity_durations[activity] = {"avg": 0, "min": 0, "max": 0, "median": 0}
        
        # Get case durations (throughput times)
        case_durations = pm4py.stats.get_all_case_durations(event_log)
        
        # Calculate log-level TPT statistics
        if case_durations:
            log_avg_tpt = round(statistics.mean(case_durations), 2)
            log_min_tpt = round(min(case_durations), 2)
            log_max_tpt = round(max(case_durations), 2)
            log_median_tpt = round(statistics.median(case_durations), 2)
        else:
            log_avg_tpt = log_min_tpt = log_max_tpt = log_median_tpt = 0
        
        # Get trace variants
        variants = pm4py.get_variants(event_log)
        num_trace_variants = len(variants)
        
        # Create a mapping of case to variant for efficient lookup
        case_to_variant = {}
        for idx, case in enumerate(event_log.groupby('case:concept:name', sort=False)):
            case_id = case[0]
            case_events = case[1]
            variant_tuple = tuple(case_events['concept:name'].tolist())
            case_to_variant[case_id] = variant_tuple
        
        # Process trace variants for display with TPT statistics
        trace_variants = []
        total_cases = num_cases
        case_ids = event_log['case:concept:name'].unique()
        
        for variant, count in variants.items():
            # Convert variant tuple to list of activities
            if isinstance(variant, tuple):
                activities = list(variant)
            else:
                activities = variant.split(',')
                variant = tuple(activities)
            
            # Get durations for all cases with this variant
            variant_durations = []
            for i, case_id in enumerate(case_ids):
                if case_to_variant.get(case_id) == variant:
                    variant_durations.append(case_durations[i])
            
            # Calculate TPT statistics for this variant
            if variant_durations:
                avg_tpt = round(statistics.mean(variant_durations), 2)
                min_tpt = round(min(variant_durations), 2)
                max_tpt = round(max(variant_durations), 2)
                median_tpt = round(statistics.median(variant_durations), 2)
            else:
                avg_tpt = min_tpt = max_tpt = median_tpt = 0
            
            trace_variants.append({
                "activities": activities,
                "frequency": count,
                "percentage": round((count / total_cases) * 100, 2),
                "avg_tpt": avg_tpt,
                "min_tpt": min_tpt,
                "max_tpt": max_tpt,
                "median_tpt": median_tpt
            })
        
        # Sort by frequency (descending)
        trace_variants.sort(key=lambda x: x['frequency'], reverse=True)
        
        # Get start and end activities
        start_activities = pm4py.get_start_activities(event_log)
        end_activities = pm4py.get_end_activities(event_log)
        
        return {
            "num_events": num_events,
            "num_cases": num_cases,
            "num_activities": num_activities,
            "num_trace_variants": num_trace_variants,
            "activity_frequencies": activity_frequencies,
            "activity_case_counts": activity_case_counts,
            "activity_durations": activity_durations,
            "trace_variants": trace_variants,
            "start_activities": start_activities,
            "end_activities": end_activities,
            "log_avg_tpt": log_avg_tpt,
            "log_min_tpt": log_min_tpt,
            "log_max_tpt": log_max_tpt,
            "log_median_tpt": log_median_tpt
        }
    except Exception as e:
        print(f"Error getting log insights: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "num_events": 0,
            "num_cases": 0,
            "num_activities": 0,
            "num_trace_variants": 0,
            "activity_frequencies": {},
            "activity_case_counts": {},
            "activity_durations": {},
            "trace_variants": [],
            "start_activities": {},
            "end_activities": {},
            "log_avg_tpt": 0,
            "log_min_tpt": 0,
            "log_max_tpt": 0,
            "log_median_tpt": 0,
            "error": str(e)
        }

# Add CORS middleware to allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5173"],  # Vite dev server ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint - returns welcome message"""
    return {"message": "Welcome to Oasis API", "status": "running"}

# ============================================================================
# DATA PAGE ENDPOINTS
# ============================================================================

@app.post("/api/upload_log")
async def upload_log(file: UploadFile = File(...)):
    """Upload event log and append to logs list"""
    global logs
    
    try:
        # Read uploaded file
        content = await file.read()
        
        if not file.filename:
            return {"message": "No file provided", "status": "error"}
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xes") as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Read the event log using PM4Py
            if file.filename.endswith('.xes'):
                event_log = pm4py.read_xes(temp_file_path)
            elif file.filename.endswith('.csv'):
                # For CSV files, convert to event log format
                df = pd.read_csv(temp_file_path)
                event_log = pm4py.convert_to_event_log(df)
            else:
                return {
                    "message": "Unsupported file format. Please upload .xes or .csv files.",
                    "status": "error"
                }
            
            # Append to logs list with both metadata and log object
            import datetime
            logs.append({
                "metadata": {
                    "filename": file.filename,
                    "uploaded_at": datetime.datetime.now().isoformat(),
                    "num_events": len(event_log),
                    "num_cases": len(event_log['case:concept:name'].unique()),
                    "num_activities": len(event_log['concept:name'].unique())
                },
                "log_object": event_log
            })
            
            return {
                "message": f"Event log successfully uploaded and processed: {file.filename}",
                "filename": file.filename,
                "status": "success"
            }
            
        except Exception as e:
            return {
                "message": f"Error processing event log: {str(e)}",
                "status": "error"
            }
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        return {
            "message": f"Error uploading file: {str(e)}",
            "status": "error"
        }

@app.post("/api/upload_model")
async def upload_model(file: UploadFile = File(...)):
    """Upload Petri net or BPMN model and append to models list"""
    global model, models
    
    try:
        # Read uploaded file
        content = await file.read()
        
        if not file.filename:
            return {"message": "No file provided", "status": "error"}
        
        # Save file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file.filename.split('.')[-1]}") as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Read the model using PM4Py based on file extension
            if file.filename.endswith('.pnml'):
                # Read Petri net
                uploaded_model = pm4py.read_pnml(temp_file_path)
                model_type = "Petri Net"
            elif file.filename.endswith('.bpmn'):
                # Read BPMN model
                uploaded_model = pm4py.read_bpmn(temp_file_path)
                model_type = "BPMN"
            else:
                return {
                    "message": "Unsupported file format. Please upload .pnml or .bpmn files.",
                    "status": "error"
                }
            
            # Set as the current active model (for conformance endpoint)
            model = uploaded_model
            
            # Save as SVG
            if file.filename.endswith('.pnml'):
                # For Petri nets, save directly
                pm4py.save_vis_petri_net(uploaded_model[0], uploaded_model[1], uploaded_model[2], 'model.svg')
            elif file.filename.endswith('.bpmn'):
                # For BPMN, convert to Petri net first, then save
                net, im, fm = pm4py.convert_to_petri_net(uploaded_model)
                pm4py.save_vis_petri_net(net, im, fm, 'model.svg')
            
            # Read the SVG content
            with open('model.svg', 'r', encoding='utf-8') as svg_file:
                svg_content = svg_file.read()
            
            # Delete temporary SVG file
            os.unlink('model.svg')
            
            # Append to models list with metadata and model object
            import datetime
            models.append({
                "metadata": {
                    "filename": file.filename,
                    "uploaded_at": datetime.datetime.now().isoformat(),
                    "model_type": model_type
                },
                "model_object": uploaded_model
            })
            
            return {
                "message": f"Model successfully uploaded and processed: {file.filename}",
                "filename": file.filename,
                "svg_content": svg_content,
                "status": "success"
            }
            
        except Exception as e:
            return {
                "message": f"Error processing model: {str(e)}",
                "status": "error"
            }
        finally:
            # Clean up temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
                
    except Exception as e:
        return {
            "message": f"Error uploading file: {str(e)}",
            "status": "error"
        }

@app.get("/api/logs")
async def get_logs():
    """Get list of uploaded event logs (metadata only)"""
    # Return only metadata, not the log objects
    logs_metadata = [log_entry["metadata"] for log_entry in logs]
    return {
        "logs": logs_metadata,
        "count": len(logs_metadata),
        "status": "success"
    }

@app.get("/api/models")
async def get_models():
    """Get list of uploaded models (metadata only)"""
    # Return only metadata, not the model objects
    models_metadata = [model_entry["metadata"] for model_entry in models]
    return {
        "models": models_metadata,
        "count": len(models_metadata),
        "status": "success"
    }

@app.delete("/api/delete_log/{index}")
async def delete_log(index: int):
    """Delete an event log from the logs list by index"""
    global logs
    
    try:
        if 0 <= index < len(logs):
            deleted_log = logs.pop(index)
            return {
                "message": f"Successfully deleted log: {deleted_log['metadata']['filename']}",
                "status": "success"
            }
        else:
            return {
                "message": f"Invalid index: {index}. No log found at this position.",
                "status": "error"
            }
    except Exception as e:
        return {
            "message": f"Error deleting log: {str(e)}",
            "status": "error"
        }

@app.delete("/api/delete_model/{index}")
async def delete_model(index: int):
    """Delete a model from the models list by index"""
    global models
    
    try:
        if 0 <= index < len(models):
            deleted_model = models.pop(index)
            return {
                "message": f"Successfully deleted model: {deleted_model['filename']}",
                "status": "success"
            }
        else:
            return {
                "message": f"Invalid index: {index}. No model found at this position.",
                "status": "error"
            }
    except Exception as e:
        return {
            "message": f"Error deleting model: {str(e)}",
            "status": "error"
        }

# ============================================================================
# EXPLORATION PAGE ENDPOINTS
# ============================================================================

@app.post("/api/explore/{log_index}")
async def explore(log_index: int):
    """Explore a specific log - discover DFG and get statistics"""
    global logs
    
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the log entry
        log_entry = logs[log_index]
        event_log = log_entry["log_object"]
        log_metadata = log_entry["metadata"]
        
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
        
        # Get first 20 events as table data
        first_20_events = []
        for idx, row in event_log.head(20).iterrows():
            event_dict = {
                'case_id': row.get('case:concept:name', ''),
                'activity': row.get('concept:name', ''),
                'timestamp': row.get('time:timestamp', '').isoformat() if hasattr(row.get('time:timestamp', ''), 'isoformat') else str(row.get('time:timestamp', '')),
                'resource': row.get('org:resource', 'N/A')
            }
            # Add any other attributes
            for col in event_log.columns:
                if col not in ['case:concept:name', 'concept:name', 'time:timestamp', 'org:resource']:
                    event_dict[col] = str(row.get(col, ''))
            first_20_events.append(event_dict)
        
        # Discover footprint matrix for the log
        log_footprints = pm4py.discover_footprints(event_log)
        
        # Convert footprint to matrix format
        def footprint_to_matrix(fp):
            """Convert footprint to matrix format"""
            activities = sorted(list(fp.get('activities', set())))
            n = len(activities)
            
            # Create activity to index mapping
            act_to_idx = {act: i for i, act in enumerate(activities)}
            
            # Initialize matrix with empty strings
            matrix = [['' for _ in range(n)] for _ in range(n)]
            
            # Fill in sequence relations
            for (a1, a2) in fp.get('sequence', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '->'
            
            # Fill in parallel relations
            for (a1, a2) in fp.get('parallel', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '||'
            
            return {
                'activities': activities,
                'matrix': matrix
            }
        
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
            "footprint_matrix": footprint_matrix,
            "status": "success"
        }
    except Exception as e:
        return {
            "message": f"Error exploring log: {str(e)}",
            "status": "error"
        }

@app.post("/api/update_dfg")
async def update_dfg(
    log_index: int = Form(...),
    selected_activities: str = Form("[]"),
    selected_variants: str = Form("[]")
):
    """Update DFG by filtering log and re-discovering DFG"""
    global logs
    
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the original log
        event_log = logs[log_index]["log_object"]
        
        # Parse selected activities and variants
        import json
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

@app.post("/api/update_event_distribution_graph")
async def update_event_distribution_graph(
    log_index: int = Form(...),
    distr_type: str = Form("days_week")
):
    """Update event distribution graph with selected distribution type"""
    global logs
    
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the log
        event_log = logs[log_index]["log_object"]
        
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

# ============================================================================
# DISCOVERY PAGE ENDPOINTS
# ============================================================================

@app.post("/api/discover_alpha")
async def discover_alpha(log_index: int = Form(...)):
    """Discover Petri net using Alpha algorithm with train/test split"""
    global logs
    
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = logs[log_index]
        log = log_entry["log_object"]
        log_metadata = log_entry["metadata"]
        
        # Split log into train and test (80/20 split)
        train_log, test_log = pm4py.split_train_test(log, train_percentage=0.8)
        
        # Discover Petri net using Alpha algorithm on training data
        net, im, fm = pm4py.discover_petri_net_alpha(train_log)
        
        # Save as SVG
        pm4py.save_vis_petri_net(net, im, fm, 'alpha_model.svg')
        
        # Read SVG content
        with open('alpha_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('alpha_model.svg')
        
        # Calculate conformance metrics on test data
        tbr_fit = pm4py.fitness_token_based_replay(test_log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(test_log, net, im, fm)
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(test_log, net, im, fm)
            align_prec = pm4py.precision_alignments(test_log, net, im, fm)
            align_fitness_value = align_fit['log_fitness']
            align_precision_value = align_prec
            alignment_available = True
        except Exception as align_error:
            # If alignment fails (e.g., non-sound Petri net), return "PN not sound"
            align_fitness_value = "PN not sound"
            align_precision_value = "PN not sound"
            alignment_available = False
        
        # Calculate additional metrics
        tbr_fitness = tbr_fit['log_fitness']
        tbr_precision = tbr_prec
        
        # F1-measure calculations
        tbr_f1 = 2 * (tbr_fitness * tbr_precision) / (tbr_fitness + tbr_precision) if (tbr_fitness + tbr_precision) > 0 else 0
        
        if alignment_available:
            align_f1 = 2 * (align_fitness_value * align_precision_value) / (align_fitness_value + align_precision_value) if (align_fitness_value + align_precision_value) > 0 else 0
            mean_fitness = (tbr_fitness + align_fitness_value) / 2
            mean_precision = (tbr_precision + align_precision_value) / 2
        else:
            align_f1 = "PN not sound"
            mean_fitness = tbr_fitness
            mean_precision = tbr_precision
        
        # Get Petri net statistics
        num_places = len(net.places)
        num_transitions = len(net.transitions)
        num_arcs = len(net.arcs)
        
        return {
            "message": "Alpha algorithm discovery completed",
            "svg_content": svg_content,
            "log_metadata": log_metadata,
            "train_stats": train_stats,
            "test_stats": test_stats,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "num_places": num_places,
            "num_transitions": num_transitions,
            "num_arcs": num_arcs,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Alpha discovery: {str(e)}",
            "status": "error"
        }

@app.post("/api/discover_ilp")
async def discover_ilp(log_index: int = Form(...), alpha: float = Form(0.5)):
    """Discover Petri net using ILP algorithm with train/test split"""
    global logs
    
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = logs[log_index]
        log = log_entry["log_object"]
        log_metadata = log_entry["metadata"]
        
        # Split log into train and test (80/20 split)
        train_log, test_log = pm4py.split_train_test(log, train_percentage=0.8)
        
        # Discover Petri net using ILP algorithm on training data
        net, im, fm = pm4py.discover_petri_net_ilp(train_log, alpha=alpha)
        
        # Save as SVG
        pm4py.save_vis_petri_net(net, im, fm, 'ilp_model.svg')
        
        # Read SVG content
        with open('ilp_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('ilp_model.svg')
        
        # Calculate conformance metrics on test data
        tbr_fit = pm4py.fitness_token_based_replay(test_log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(test_log, net, im, fm)
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(test_log, net, im, fm)
            align_prec = pm4py.precision_alignments(test_log, net, im, fm)
            align_fitness_value = align_fit['log_fitness']
            align_precision_value = align_prec
            alignment_available = True
        except Exception as align_error:
            align_fitness_value = "PN not sound"
            align_precision_value = "PN not sound"
            alignment_available = False
        
        # Calculate additional metrics
        tbr_fitness = tbr_fit['log_fitness']
        tbr_precision = tbr_prec
        
        # F1-measure calculations
        tbr_f1 = 2 * (tbr_fitness * tbr_precision) / (tbr_fitness + tbr_precision) if (tbr_fitness + tbr_precision) > 0 else 0
        
        if alignment_available:
            align_f1 = 2 * (align_fitness_value * align_precision_value) / (align_fitness_value + align_precision_value) if (align_fitness_value + align_precision_value) > 0 else 0
            mean_fitness = (tbr_fitness + align_fitness_value) / 2
            mean_precision = (tbr_precision + align_precision_value) / 2
        else:
            align_f1 = "PN not sound"
            mean_fitness = tbr_fitness
            mean_precision = tbr_precision
        
        # Get Petri net statistics
        num_places = len(net.places)
        num_transitions = len(net.transitions)
        num_arcs = len(net.arcs)
        
        return {
            "message": "ILP algorithm discovery completed",
            "svg_content": svg_content,
            "log_metadata": log_metadata,
            "train_stats": train_stats,
            "test_stats": test_stats,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "num_places": num_places,
            "num_transitions": num_transitions,
            "num_arcs": num_arcs,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in ILP discovery: {str(e)}",
            "status": "error"
        }

@app.post("/api/discover_heuristics")
async def discover_heuristics(
    log_index: int = Form(...),
    dependency_threshold: float = Form(0.9),
    and_threshold: float = Form(0.9),
    loop_two_threshold: float = Form(0.9)
):
    """Discover Petri net using Heuristics algorithm with train/test split"""
    global logs
    
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = logs[log_index]
        log = log_entry["log_object"]
        log_metadata = log_entry["metadata"]
        
        # Split log into train and test (80/20 split)
        train_log, test_log = pm4py.split_train_test(log, train_percentage=0.8)
        
        # Discover Petri net using Heuristics algorithm on training data
        net, im, fm = pm4py.discover_petri_net_heuristics(
            train_log, 
            dependency_threshold=dependency_threshold,
            and_threshold=and_threshold,
            loop_two_threshold=loop_two_threshold
        )
        
        # Save as SVG
        pm4py.save_vis_petri_net(net, im, fm, 'heuristics_model.svg')
        
        # Read SVG content
        with open('heuristics_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('heuristics_model.svg')
        
        # Calculate conformance metrics on test data
        tbr_fit = pm4py.fitness_token_based_replay(test_log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(test_log, net, im, fm)
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(test_log, net, im, fm)
            align_prec = pm4py.precision_alignments(test_log, net, im, fm)
            align_fitness_value = align_fit['log_fitness']
            align_precision_value = align_prec
            alignment_available = True
        except Exception as align_error:
            align_fitness_value = "PN not sound"
            align_precision_value = "PN not sound"
            alignment_available = False
        
        # Calculate additional metrics
        tbr_fitness = tbr_fit['log_fitness']
        tbr_precision = tbr_prec
        
        # F1-measure calculations
        tbr_f1 = 2 * (tbr_fitness * tbr_precision) / (tbr_fitness + tbr_precision) if (tbr_fitness + tbr_precision) > 0 else 0
        
        if alignment_available:
            align_f1 = 2 * (align_fitness_value * align_precision_value) / (align_fitness_value + align_precision_value) if (align_fitness_value + align_precision_value) > 0 else 0
            mean_fitness = (tbr_fitness + align_fitness_value) / 2
            mean_precision = (tbr_precision + align_precision_value) / 2
        else:
            align_f1 = "PN not sound"
            mean_fitness = tbr_fitness
            mean_precision = tbr_precision
        
        # Get Petri net statistics
        num_places = len(net.places)
        num_transitions = len(net.transitions)
        num_arcs = len(net.arcs)
        
        return {
            "message": "Heuristics algorithm discovery completed",
            "svg_content": svg_content,
            "log_metadata": log_metadata,
            "train_stats": train_stats,
            "test_stats": test_stats,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "num_places": num_places,
            "num_transitions": num_transitions,
            "num_arcs": num_arcs,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Heuristics discovery: {str(e)}",
            "status": "error"
        }

@app.post("/api/discover_inductive")
async def discover_inductive(log_index: int = Form(...), noise_threshold: float = Form(0.2)):
    """Discover Petri net using Inductive algorithm with train/test split"""
    global logs
    
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = logs[log_index]
        log = log_entry["log_object"]
        log_metadata = log_entry["metadata"]
        
        # Split log into train and test (80/20 split)
        train_log, test_log = pm4py.split_train_test(log, train_percentage=0.8)
        
        # Discover Petri net using Inductive algorithm on training data
        net, im, fm = pm4py.discover_petri_net_inductive(train_log, noise_threshold=noise_threshold)
        
        # Save as SVG
        pm4py.save_vis_petri_net(net, im, fm, 'inductive_model.svg')
        
        # Read SVG content
        with open('inductive_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('inductive_model.svg')
        
        # Calculate conformance metrics on test data
        tbr_fit = pm4py.fitness_token_based_replay(test_log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(test_log, net, im, fm)
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(test_log, net, im, fm)
            align_prec = pm4py.precision_alignments(test_log, net, im, fm)
            align_fitness_value = align_fit['log_fitness']
            align_precision_value = align_prec
            alignment_available = True
        except Exception as align_error:
            align_fitness_value = "PN not sound"
            align_precision_value = "PN not sound"
            alignment_available = False
        
        # Calculate additional metrics
        tbr_fitness = tbr_fit['log_fitness']
        tbr_precision = tbr_prec
        
        # F1-measure calculations
        tbr_f1 = 2 * (tbr_fitness * tbr_precision) / (tbr_fitness + tbr_precision) if (tbr_fitness + tbr_precision) > 0 else 0
        
        if alignment_available:
            align_f1 = 2 * (align_fitness_value * align_precision_value) / (align_fitness_value + align_precision_value) if (align_fitness_value + align_precision_value) > 0 else 0
            mean_fitness = (tbr_fitness + align_fitness_value) / 2
            mean_precision = (tbr_precision + align_precision_value) / 2
        else:
            align_f1 = "PN not sound"
            mean_fitness = tbr_fitness
            mean_precision = tbr_precision
        
        # Get Petri net statistics
        num_places = len(net.places)
        num_transitions = len(net.transitions)
        num_arcs = len(net.arcs)
        
        return {
            "message": "Inductive algorithm discovery completed",
            "svg_content": svg_content,
            "log_metadata": log_metadata,
            "train_stats": train_stats,
            "test_stats": test_stats,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "num_places": num_places,
            "num_transitions": num_transitions,
            "num_arcs": num_arcs,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Inductive discovery: {str(e)}",
            "status": "error"
        }

# ============================================================================
# CONFORMANCE PAGE ENDPOINTS
# ============================================================================

@app.post("/api/conformance_log_log")
async def conformance_log_log(log_index_1: int = Form(...), log_index_2: int = Form(...)):
    """Perform footprint-based conformance checking between two logs"""
    global logs
    
    try:
        # Validate log indices
        if log_index_1 < 0 or log_index_1 >= len(logs):
            return {"message": f"Invalid first log index: {log_index_1}", "status": "error"}
        if log_index_2 < 0 or log_index_2 >= len(logs):
            return {"message": f"Invalid second log index: {log_index_2}", "status": "error"}
        
        # Get the logs
        log1 = logs[log_index_1]["log_object"]
        log2 = logs[log_index_2]["log_object"]
        log1_metadata = logs[log_index_1]["metadata"]
        log2_metadata = logs[log_index_2]["metadata"]
        
        # Get log statistics
        num_events_1 = len(log1)
        num_cases_1 = len(log1['case:concept:name'].unique())
        num_events_2 = len(log2)
        num_cases_2 = len(log2['case:concept:name'].unique())
        
        # Discover footprints for both logs
        footprints1 = pm4py.discover_footprints(log1)
        footprints2 = pm4py.discover_footprints(log2)
        
        # Convert footprints to matrix format
        def footprint_to_matrix(fp):
            """Convert footprint to matrix format"""
            activities = sorted(list(fp.get('activities', set())))
            n = len(activities)
            
            # Create activity to index mapping
            act_to_idx = {act: i for i, act in enumerate(activities)}
            
            # Initialize matrix with empty strings
            matrix = [['' for _ in range(n)] for _ in range(n)]
            
            # Fill in sequence relations
            for (a1, a2) in fp.get('sequence', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '->'
            
            # Fill in parallel relations
            for (a1, a2) in fp.get('parallel', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '||'
            
                return {
                'activities': activities,
                'matrix': matrix
            }
        
        footprint1_matrix = footprint_to_matrix(footprints1)
        footprint2_matrix = footprint_to_matrix(footprints2)
        
        # Calculate number of different cells
        def count_differences(fp1, fp2):
            """Count differences between two footprints"""
            seq1 = fp1.get('sequence', set())
            seq2 = fp2.get('sequence', set())
            par1 = fp1.get('parallel', set())
            par2 = fp2.get('parallel', set())
            
            # Count symmetric differences
            diff_count = len(seq1.symmetric_difference(seq2))
            diff_count += len(par1.symmetric_difference(par2))
            
            return diff_count
        
        num_different_cells = count_differences(footprints1, footprints2)
        
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

@app.post("/api/conformance_log_model")
async def conformance_log_model(log_index: int = Form(...), model_index: int = Form(...)):
    """Perform conformance checking between log and model"""
    global logs, models
    
    try:
        # Validate indices
        if log_index < 0 or log_index >= len(logs):
            return {"message": f"Invalid log index: {log_index}", "status": "error"}
        if model_index < 0 or model_index >= len(models):
            return {"message": f"Invalid model index: {model_index}", "status": "error"}
        
        # Get the log and model
        log = logs[log_index]["log_object"]
        log_metadata = logs[log_index]["metadata"]
        uploaded_model = models[model_index]["model_object"]
        model_metadata = models[model_index]["metadata"]
        
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
        
        # Convert footprints to matrix format
        def footprint_to_matrix(fp):
            """Convert footprint to matrix format"""
            activities = sorted(list(fp.get('activities', set())))
            n = len(activities)
            
            # Create activity to index mapping
            act_to_idx = {act: i for i, act in enumerate(activities)}
            
            # Initialize matrix with empty strings
            matrix = [['' for _ in range(n)] for _ in range(n)]
            
            # Fill in sequence relations
            for (a1, a2) in fp.get('sequence', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '->'
            
            # Fill in parallel relations
            for (a1, a2) in fp.get('parallel', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '||'
            
            return {
                'activities': activities,
                'matrix': matrix
            }
        
        log_footprint_matrix = footprint_to_matrix(log_footprints)
        model_footprint_matrix = footprint_to_matrix(model_footprints)
        
        # Calculate number of different cells
        def count_differences(fp1, fp2):
            """Count differences between two footprints"""
            seq1 = fp1.get('sequence', set())
            seq2 = fp2.get('sequence', set())
            par1 = fp1.get('parallel', set())
            par2 = fp2.get('parallel', set())
            
            # Count symmetric differences
            diff_count = len(seq1.symmetric_difference(seq2))
            diff_count += len(par1.symmetric_difference(par2))
            
            return diff_count
        
        num_different_cells = count_differences(log_footprints, model_footprints)
        
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

@app.post("/api/compute_custom_alignment")
async def compute_custom_alignment(
    log_index: int = Form(...),
    model_index: int = Form(...),
    trace_activities: str = Form(...)
):
    """Compute alignment for a custom trace"""
    global logs, models
    
    try:
        # Validate indices
        if log_index < 0 or log_index >= len(logs):
            return {"message": f"Invalid log index: {log_index}", "status": "error"}
        if model_index < 0 or model_index >= len(models):
            return {"message": f"Invalid model index: {model_index}", "status": "error"}
        
        # Parse the trace activities
        import json
        activities = json.loads(trace_activities)
        
        if not activities or len(activities) == 0:
            return {"message": "Please provide at least one activity", "status": "error"}
        
        # Get the original log and model
        original_log = logs[log_index]["log_object"]
        uploaded_model = models[model_index]["model_object"]
        
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

@app.post("/api/conformance_model_model")
async def conformance_model_model(model_index_1: int = Form(...), model_index_2: int = Form(...)):
    """Perform footprint-based conformance checking between two models"""
    global models
    
    try:
        # Validate model indices
        if model_index_1 < 0 or model_index_1 >= len(models):
            return {"message": f"Invalid first model index: {model_index_1}", "status": "error"}
        if model_index_2 < 0 or model_index_2 >= len(models):
            return {"message": f"Invalid second model index: {model_index_2}", "status": "error"}
        
        # Get the models
        model1 = models[model_index_1]["model_object"]
        model2 = models[model_index_2]["model_object"]
        model1_metadata = models[model_index_1]["metadata"]
        model2_metadata = models[model_index_2]["metadata"]
        
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
        
        # Convert footprints to matrix format
        def footprint_to_matrix(fp):
            """Convert footprint to matrix format"""
            activities = sorted(list(fp.get('activities', set())))
            n = len(activities)
            
            # Create activity to index mapping
            act_to_idx = {act: i for i, act in enumerate(activities)}
            
            # Initialize matrix with empty strings
            matrix = [['' for _ in range(n)] for _ in range(n)]
            
            # Fill in sequence relations
            for (a1, a2) in fp.get('sequence', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '->'
            
            # Fill in parallel relations
            for (a1, a2) in fp.get('parallel', set()):
                if a1 in act_to_idx and a2 in act_to_idx:
                    matrix[act_to_idx[a1]][act_to_idx[a2]] = '||'
            
            # Note: Choice relations are implicit (no direct relation)
            
            return {
                'activities': activities,
                'matrix': matrix
            }
        
        footprint1_matrix = footprint_to_matrix(footprints1)
        footprint2_matrix = footprint_to_matrix(footprints2)
        
        # Calculate number of different cells
        def count_differences(fp1, fp2):
            """Count differences between two footprints"""
            seq1 = fp1.get('sequence', set())
            seq2 = fp2.get('sequence', set())
            par1 = fp1.get('parallel', set())
            par2 = fp2.get('parallel', set())
            
            # Count symmetric differences
            diff_count = len(seq1.symmetric_difference(seq2))
            diff_count += len(par1.symmetric_difference(par2))
            
            return diff_count
        
        num_different_cells = count_differences(footprints1, footprints2)
        
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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
