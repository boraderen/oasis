"""OCPM (Object-Centric Process Mining) router for OCEL exploration and OCDFG discovery."""
from fastapi import APIRouter, Body
import pm4py
import os
from typing import Dict, Any
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


@router.post("/api/update_ocel_event_distribution")
async def update_ocel_event_distribution(data: Dict[Any, Any] = Body(...)):
    """Update event distribution graph for a specific object type's flattened log"""
    try:
        ocel_index = data.get('ocel_index')
        object_type = data.get('object_type')
        distr_type = data.get('distr_type')
        # Validate OCEL index
        if ocel_index < 0 or ocel_index >= len(state.ocels):
            return {
                "message": f"Invalid OCEL index: {ocel_index}",
                "status": "error"
            }
        
        # Get the OCEL
        ocel = state.ocels[ocel_index]["ocel_object"]
        
        # Flatten the OCEL for the object type
        flattened_log = pm4py.ocel_flattening(ocel, object_type)
        
        # Validate distribution type
        valid_types = ['days_month', 'months', 'years', 'hours', 'days_week', 'weeks']
        if distr_type not in valid_types:
            return {
                "message": f"Invalid distribution type. Must be one of: {', '.join(valid_types)}",
                "status": "error"
            }
        
        # Generate event distribution graph with selected type
        filename = f'distribution_{object_type}_{distr_type}.svg'
        pm4py.save_vis_events_distribution_graph(flattened_log, filename, distr_type=distr_type)
        with open(filename, 'r', encoding='utf-8') as f:
            event_distribution_svg = f.read()
        os.unlink(filename)
        
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


@router.post("/api/explore_ocel/{ocel_index}")
async def explore_ocel(ocel_index: int):
    """Explore a specific OCEL - discover OCDFG, Object Graph, and DFGs per object type"""
    try:
        # Validate OCEL index
        if ocel_index < 0 or ocel_index >= len(state.ocels):
            return {
                "message": f"Invalid OCEL index: {ocel_index}",
                "status": "error"
            }
        
        # Get the OCEL entry
        ocel_entry = state.ocels[ocel_index]
        ocel = ocel_entry["ocel_object"]
        ocel_metadata = ocel_entry["metadata"]
        
        # Discover OCDFG (Object-Centric Directly-Follows Graph)
        ocdfg = pm4py.discover_ocdfg(ocel)
        
        # Visualize OCDFG and save as SVG
        pm4py.save_vis_ocdfg(ocdfg, 'ocdfg.svg')
        
        # Read the OCDFG SVG content
        with open('ocdfg.svg', 'r', encoding='utf-8') as svg_file:
            ocdfg_svg_content = svg_file.read()
        
        # Delete the temporary OCDFG SVG file
        os.unlink('ocdfg.svg')
        
        # Discover Object Graph (skip for large OCELs to avoid blocking)
        object_graph_svg_content = None
        num_events = len(ocel.events)
        num_objects = len(ocel.objects)
        
        # Only attempt object graph for smaller OCELs (< 500 objects)
        if num_objects < 500:
            try:
                import signal
                
                # Define timeout handler
                def timeout_handler(signum, frame):
                    raise TimeoutError("Object graph generation timed out")
                
                # Set 10-second timeout for object graph generation
                signal.signal(signal.SIGALRM, timeout_handler)
                signal.alarm(10)
                
                try:
                    object_graph = pm4py.discover_objects_graph(ocel, graph_type='object_interaction')
                    pm4py.save_vis_object_graph(ocel, object_graph, 'object_graph.svg')
                    
                    with open('object_graph.svg', 'r', encoding='utf-8') as svg_file:
                        object_graph_svg_content = svg_file.read()
                    
                    os.unlink('object_graph.svg')
                finally:
                    # Cancel the alarm
                    signal.alarm(0)
                    
            except Exception:
                # Object graph discovery failed or timed out
                object_graph_svg_content = None
                # Clean up temp file if it exists
                if os.path.exists('object_graph.svg'):
                    os.unlink('object_graph.svg')
        
        
        # Get object types
        object_types = list(ocel.objects['ocel:type'].unique()) if 'ocel:type' in ocel.objects.columns else []
        
        # Get activity information
        activities = list(ocel.events['ocel:activity'].unique()) if 'ocel:activity' in ocel.events.columns else []
        num_activities = len(activities)
        
        # Get event-to-object relationships
        relations = []
        if hasattr(ocel, 'relations') and ocel.relations is not None:
            relations = ocel.relations.to_dict('records')[:100]  # Limit to first 100 for performance
        
        # Get object type counts
        object_type_counts = {}
        if 'ocel:type' in ocel.objects.columns:
            object_type_counts = ocel.objects['ocel:type'].value_counts().to_dict()
        
        # Get activity counts
        activity_counts = {}
        if 'ocel:activity' in ocel.events.columns:
            activity_counts = ocel.events['ocel:activity'].value_counts().to_dict()
        
        # Calculate activity durations for OCEL level if start_timestamp exists
        import statistics
        has_start_timestamp = 'ocel:timestamp' in ocel.events.columns and 'start_timestamp' in ocel.events.columns
        activity_durations = {}
        
        if has_start_timestamp:
            for activity in activities:
                activity_events = ocel.events[ocel.events['ocel:activity'] == activity]
                durations = []
                for idx, event in activity_events.iterrows():
                    if 'start_timestamp' in event and 'ocel:timestamp' in event:
                        try:
                            duration = (event['ocel:timestamp'] - event['start_timestamp']).total_seconds()
                            if duration >= 0:
                                durations.append(duration)
                        except:
                            pass
                
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
            for activity in activities:
                activity_durations[activity] = {"avg": 0, "min": 0, "max": 0, "median": 0}
        
        # Get extended table with all event and object information
        try:
            extended_table = ocel.get_extended_table()
            
            # Get first 100 rows from extended table
            first_100_rows = []
            for idx, row in extended_table.head(100).iterrows():
                row_dict = {}
                # Add all columns from the extended table
                for col in extended_table.columns:
                    value = row.get(col, '')
                    if isinstance(value, (list, set)):
                        row_dict[col] = str(list(value))
                    else:
                        row_dict[col] = convert_value_to_serializable(value)
                first_100_rows.append(row_dict)
            
            # Get all column names for the table
            table_columns = list(extended_table.columns)
        except Exception as table_error:
            print(f"Error getting extended table: {str(table_error)}")
            import traceback
            traceback.print_exc()
            # Fallback to events table
            first_100_rows = []
            for idx, row in ocel.events.head(100).iterrows():
                event_dict = {}
                for col in ocel.events.columns:
                    value = row.get(col, '')
                    event_dict[col] = convert_value_to_serializable(value)
                first_100_rows.append(event_dict)
            table_columns = list(ocel.events.columns)
        
        # Flatten OCEL by each object type and discover comprehensive data
        object_type_data = {}
        for obj_type in object_types:
            try:
                # Flatten the OCEL for this object type
                flattened_log = pm4py.ocel_flattening(ocel, obj_type)
                
                # Write flattened log to temporary XES file and read it again
                # This ensures proper formatting for trace variant discovery
                temp_xes_path = f'temp_flattened_{obj_type}.xes'
                pm4py.write_xes(flattened_log, temp_xes_path)
                flattened_log = pm4py.read_xes(temp_xes_path)
                os.unlink(temp_xes_path)
                
                # Capture original columns BEFORE any PM4Py processing
                # (PM4Py may add columns like start_timestamp during processing)
                original_flattened_columns = list(flattened_log.columns)
                
                # Discover regular DFG
                dfg, sa, ea = pm4py.discover_dfg(flattened_log)
                pm4py.save_vis_dfg(dfg, sa, ea, f'dfg_{obj_type}.svg')
                with open(f'dfg_{obj_type}.svg', 'r', encoding='utf-8') as f:
                    regular_dfg_svg = f.read()
                os.unlink(f'dfg_{obj_type}.svg')
                
                # Discover performance DFG (may fail due to datetime type issues)
                try:
                    perf_dfg, perf_sa, perf_ea = pm4py.discover_performance_dfg(flattened_log)
                    pm4py.save_vis_performance_dfg(perf_dfg, perf_sa, perf_ea, f'perf_dfg_{obj_type}.svg')
                    with open(f'perf_dfg_{obj_type}.svg', 'r', encoding='utf-8') as f:
                        performance_dfg_svg = f.read()
                    os.unlink(f'perf_dfg_{obj_type}.svg')
                except Exception as perf_error:
                    # Performance DFG failed (datetime type issues) - use regular DFG as fallback
                    print(f"⚠️  Performance DFG failed for '{obj_type}', using regular DFG as fallback")
                    performance_dfg_svg = regular_dfg_svg
                
                # Get log insights
                insights = get_log_insights(flattened_log)
                
                # Generate visualizations (with individual error handling)
                try:
                    pm4py.save_vis_dotted_chart(flattened_log, f'dotted_{obj_type}.svg', show_legend=False)
                    with open(f'dotted_{obj_type}.svg', 'r', encoding='utf-8') as f:
                        dotted_chart_svg = f.read()
                    os.unlink(f'dotted_{obj_type}.svg')
                except Exception as e:
                    print(f"⚠️  Dotted chart failed for '{obj_type}': {str(e)}")
                    dotted_chart_svg = '<svg><text x="10" y="20">Visualization unavailable</text></svg>'
                
                try:
                    pm4py.save_vis_case_duration_graph(flattened_log, f'duration_{obj_type}.svg')
                    with open(f'duration_{obj_type}.svg', 'r', encoding='utf-8') as f:
                        case_duration_svg = f.read()
                    os.unlink(f'duration_{obj_type}.svg')
                except Exception as e:
                    print(f"⚠️  Case duration graph failed for '{obj_type}': {str(e)}")
                    case_duration_svg = '<svg><text x="10" y="20">Visualization unavailable</text></svg>'
                
                try:
                    pm4py.save_vis_events_per_time_graph(flattened_log, f'events_time_{obj_type}.svg')
                    with open(f'events_time_{obj_type}.svg', 'r', encoding='utf-8') as f:
                        events_per_time_svg = f.read()
                    os.unlink(f'events_time_{obj_type}.svg')
                except Exception as e:
                    print(f"⚠️  Events per time graph failed for '{obj_type}': {str(e)}")
                    events_per_time_svg = '<svg><text x="10" y="20">Visualization unavailable</text></svg>'
                
                try:
                    pm4py.save_vis_events_distribution_graph(flattened_log, f'distribution_{obj_type}.svg', distr_type='days_week')
                    with open(f'distribution_{obj_type}.svg', 'r', encoding='utf-8') as f:
                        event_distribution_svg = f.read()
                    os.unlink(f'distribution_{obj_type}.svg')
                except Exception as e:
                    print(f"⚠️  Event distribution graph failed for '{obj_type}': {str(e)}")
                    event_distribution_svg = '<svg><text x="10" y="20">Visualization unavailable</text></svg>'
                
                # Get first 20 events with ONLY original columns
                first_20_events = []
                for idx, row in flattened_log.head(20).iterrows():
                    event_dict = {}
                    # Add only the original columns (exclude PM4Py-added columns)
                    for col in original_flattened_columns:
                        value = row.get(col, '')
                        event_dict[col] = convert_value_to_serializable(value)
                    first_20_events.append(event_dict)
                
                # Use original column names for the table
                flattened_columns = original_flattened_columns
                
                # Get footprint matrix
                footprints = pm4py.discover_footprints(flattened_log)
                footprint_matrix = footprint_to_matrix(footprints)
                
                # Store all data for this object type
                object_type_data[obj_type] = {
                    'regular_dfg_svg': regular_dfg_svg,
                    'performance_dfg_svg': performance_dfg_svg,
                    'insights': insights,
                    'dotted_chart_svg': dotted_chart_svg,
                    'case_duration_svg': case_duration_svg,
                    'events_per_time_svg': events_per_time_svg,
                    'event_distribution_svg': event_distribution_svg,
                    'first_20_events': first_20_events,
                    'flattened_columns': flattened_columns,
                    'footprint_matrix': footprint_matrix
                }
                
            except Exception as obj_error:
                # Log the error for debugging but continue
                print(f"⚠️  Error processing object type '{obj_type}': {str(obj_error)}")
                import traceback
                traceback.print_exc()
                object_type_data[obj_type] = None
        
        return {
            "message": "OCEL exploration completed successfully",
            "ocdfg_svg_content": ocdfg_svg_content,
            "object_graph_svg_content": object_graph_svg_content,
            "ocel_metadata": ocel_metadata,
            "num_events": num_events,
            "num_objects": num_objects,
            "num_activities": num_activities,
            "object_types": object_types,
            "object_type_counts": object_type_counts,
            "activities": activities,
            "activity_counts": activity_counts,
            "activity_durations": activity_durations,
            "extended_table_rows": first_100_rows,
            "table_columns": table_columns,
            "object_type_data": object_type_data,
            "status": "success"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "message": f"Error exploring OCEL: {str(e)}",
            "status": "error"
        }

