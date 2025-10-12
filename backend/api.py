from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import pandas as pd
import pm4py
import json
import tempfile
import os

app = FastAPI(title="Oasis API", version="1.0.0")

# Global variable to store the uploaded event log
log = None

# Global variables to store DFG components
dfg = None
sa = None
ea = None

# Global variable to store the uploaded model
model = None

def get_log_insights(event_log):
    """Extract insights and statistics from the event log"""
    try:
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
        
        # Get trace variants
        variants = pm4py.get_variants(event_log)
        num_trace_variants = len(variants)
        
        # Process trace variants for display
        trace_variants = []
        total_cases = num_cases
        for variant, count in variants.items():
            # Convert variant tuple to list of activities
            if isinstance(variant, tuple):
                activities = list(variant)
            else:
                activities = variant.split(',')
            
            trace_variants.append({
                "activities": activities,
                "frequency": count,
                "percentage": round((count / total_cases) * 100, 2)
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
            "trace_variants": trace_variants,
            "start_activities": start_activities,
            "end_activities": end_activities
        }
    except Exception as e:
        print(f"Error getting log insights: {str(e)}")
        return {
            "num_events": 0,
            "num_cases": 0,
            "num_activities": 0,
            "num_trace_variants": 0,
            "activity_frequencies": {},
            "activity_case_counts": {},
            "trace_variants": [],
            "start_activities": {},
            "end_activities": {},
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

@app.get("/")
async def root():
    """Root endpoint - returns welcome message"""
    return {"message": "Welcome to Oasis API", "status": "running"}

@app.post("/api/update_dfg")
async def update_dfg(
    activity_threshold: float = Form(0.5),
    path_threshold: float = Form(0.2)):
    """Update DFG with new thresholds"""
    global dfg, sa, ea
    
    if dfg is None or sa is None or ea is None:
        return {"message": "No DFG data available. Please upload a log first.", "status": "error"}
    
    try:
        # Apply activity filtering first
        f_dfg, f_sa, f_ea = pm4py.filter_dfg_activities_percentage(dfg, sa, ea, percentage=activity_threshold)
        
        # Apply path filtering
        f_dfg, f_sa, f_ea = pm4py.filter_dfg_paths_percentage(f_dfg, f_sa, f_ea, percentage=path_threshold)
        
        # Generate visualization
        pm4py.save_vis_dfg(f_dfg, f_sa, f_ea, 'dfg.svg')
        
        # Read the SVG content
        with open('dfg.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete the temporary SVG file
        os.unlink('dfg.svg')
        
        return {
            "message": f"DFG updated with activity threshold {activity_threshold} and path threshold {path_threshold}",
            "svg_content": svg_content,
            "activity_threshold": activity_threshold,
            "path_threshold": path_threshold,
            "status": "success"
        }
    except Exception as e:
        return {
            "message": f"Error updating DFG: {str(e)}",
            "status": "error"
        }

@app.post("/api/update_stats")
async def update_stats():
    """Update statistics from the global log"""
    global log
    
    if log is None:
        return {"message": "No event log uploaded. Please upload a log first.", "status": "error"}
    
    try:
        # Get log insights and statistics
        insights = get_log_insights(log)
        
        return {
            "message": "Statistics updated successfully",
            "insights": insights,
            "status": "success"
        }
    except Exception as e:
        return {
            "message": f"Error updating statistics: {str(e)}",
            "status": "error"
        }

@app.post("/api/upload_log")
async def upload_log(file: UploadFile = File(...)):
    """Upload event log and store it globally"""
    global log, dfg, sa, ea
    
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
                log = pm4py.read_xes(temp_file_path)
            elif file.filename.endswith('.csv'):
                # For CSV files, convert to event log format
                df = pd.read_csv(temp_file_path)
                log = pm4py.convert_to_event_log(df)
            else:
                return {
                    "message": "Unsupported file format. Please upload .xes or .csv files.",
                    "status": "error"
                }
            
            # Discover DFG components and store them globally
            dfg, sa, ea = pm4py.discover_dfg(log)
            
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

@app.post("/api/discover_alpha")
async def discover_alpha():
    """Discover Petri net using Alpha algorithm"""
    global log
    
    if log is None:
        return {"message": "No event log uploaded. Please upload a log first.", "status": "error"}
    
    try:
        # Discover Petri net using Alpha algorithm
        net, im, fm = pm4py.discover_petri_net_alpha(log)
        
        # Save as SVG
        pm4py.save_vis_petri_net(net, im, fm, 'alpha_model.svg')
        
        # Read SVG content
        with open('alpha_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('alpha_model.svg')
        
        # Calculate conformance metrics
        tbr_fit = pm4py.fitness_token_based_replay(log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(log, net, im, fm)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(log, net, im, fm)
            align_prec = pm4py.precision_alignments(log, net, im, fm)
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
        
        # Simplicity measure using the formula:
        # Simplicity_log = (|A| / |T|) * (1 / (1 + (|P| + |F|) / (|E| + |C|)))
        # Where:
        # |A|: number of distinct activities in the log
        # |E|: total number of events in the log
        # |C|: number of cases in the log
        # |P|: number of places in the Petri net
        # |T|: number of transitions
        # |F|: number of arcs
        
        # Get log statistics
        num_activities = len(log['concept:name'].unique())  # |A|
        num_events = len(log)  # |E|
        num_cases = len(log['case:concept:name'].unique())  # |C|
        
        # Get Petri net statistics
        num_transitions = len(net.transitions)  # |T|
        num_places = len(net.places)  # |P|
        num_arcs = len(net.arcs)  # |F|
        
        # Calculate simplicity
        if num_transitions > 0:
            activity_transition_ratio = num_activities / num_transitions
            complexity_factor = (num_places + num_arcs) / (num_events + num_cases)
            simplicity = activity_transition_ratio * (1 / (1 + complexity_factor))
        else:
            simplicity = 0
        
        return {
            "message": "Alpha algorithm discovery completed",
            "svg_content": svg_content,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "simplicity": simplicity,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Alpha discovery: {str(e)}",
            "status": "error"
        }

@app.post("/api/discover_ilp")
async def discover_ilp(alpha: float = Form(0.5)):
    """Discover Petri net using ILP algorithm"""
    global log
    
    if log is None:
        return {"message": "No event log uploaded. Please upload a log first.", "status": "error"}
    
    try:
        # Discover Petri net using ILP algorithm
        net, im, fm = pm4py.discover_petri_net_ilp(log, alpha=alpha)
        
        # Save as SVG
        pm4py.save_vis_petri_net(net, im, fm, 'ilp_model.svg')
        
        # Read SVG content
        with open('ilp_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('ilp_model.svg')
        
        # Calculate conformance metrics
        tbr_fit = pm4py.fitness_token_based_replay(log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(log, net, im, fm)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(log, net, im, fm)
            align_prec = pm4py.precision_alignments(log, net, im, fm)
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
        
        # Simplicity measure using the formula:
        # Simplicity_log = (|A| / |T|) * (1 / (1 + (|P| + |F|) / (|E| + |C|)))
        # Where:
        # |A|: number of distinct activities in the log
        # |E|: total number of events in the log
        # |C|: number of cases in the log
        # |P|: number of places in the Petri net
        # |T|: number of transitions
        # |F|: number of arcs
        
        # Get log statistics
        num_activities = len(log['concept:name'].unique())  # |A|
        num_events = len(log)  # |E|
        num_cases = len(log['case:concept:name'].unique())  # |C|
        
        # Get Petri net statistics
        num_transitions = len(net.transitions)  # |T|
        num_places = len(net.places)  # |P|
        num_arcs = len(net.arcs)  # |F|
        
        # Calculate simplicity
        if num_transitions > 0:
            activity_transition_ratio = num_activities / num_transitions
            complexity_factor = (num_places + num_arcs) / (num_events + num_cases)
            simplicity = activity_transition_ratio * (1 / (1 + complexity_factor))
        else:
            simplicity = 0
        
        return {
            "message": "ILP algorithm discovery completed",
            "svg_content": svg_content,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "simplicity": simplicity,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in ILP discovery: {str(e)}",
            "status": "error"
        }

@app.post("/api/discover_heuristics")
async def discover_heuristics(
    dependency_threshold: float = Form(0.9),
    and_threshold: float = Form(0.9),
    loop_two_threshold: float = Form(0.9)
):
    """Discover Petri net using Heuristics algorithm"""
    global log
    
    if log is None:
        return {"message": "No event log uploaded. Please upload a log first.", "status": "error"}
    
    try:
        # Discover Petri net using Heuristics algorithm
        net, im, fm = pm4py.discover_petri_net_heuristics(
            log, 
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
        
        # Calculate conformance metrics
        tbr_fit = pm4py.fitness_token_based_replay(log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(log, net, im, fm)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(log, net, im, fm)
            align_prec = pm4py.precision_alignments(log, net, im, fm)
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
        
        # Simplicity measure using the formula:
        # Simplicity_log = (|A| / |T|) * (1 / (1 + (|P| + |F|) / (|E| + |C|)))
        # Where:
        # |A|: number of distinct activities in the log
        # |E|: total number of events in the log
        # |C|: number of cases in the log
        # |P|: number of places in the Petri net
        # |T|: number of transitions
        # |F|: number of arcs
        
        # Get log statistics
        num_activities = len(log['concept:name'].unique())  # |A|
        num_events = len(log)  # |E|
        num_cases = len(log['case:concept:name'].unique())  # |C|
        
        # Get Petri net statistics
        num_transitions = len(net.transitions)  # |T|
        num_places = len(net.places)  # |P|
        num_arcs = len(net.arcs)  # |F|
        
        # Calculate simplicity
        if num_transitions > 0:
            activity_transition_ratio = num_activities / num_transitions
            complexity_factor = (num_places + num_arcs) / (num_events + num_cases)
            simplicity = activity_transition_ratio * (1 / (1 + complexity_factor))
        else:
            simplicity = 0
        
        return {
            "message": "Heuristics algorithm discovery completed",
            "svg_content": svg_content,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "simplicity": simplicity,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Heuristics discovery: {str(e)}",
            "status": "error"
        }

@app.post("/api/discover_inductive")
async def discover_inductive(noise_threshold: float = Form(0.2)):
    """Discover Petri net using Inductive algorithm"""
    global log
    
    if log is None:
        return {"message": "No event log uploaded. Please upload a log first.", "status": "error"}
    
    try:
        # Discover Petri net using Inductive algorithm
        net, im, fm = pm4py.discover_petri_net_inductive(log, noise_threshold=noise_threshold)
        
        # Save as SVG
        pm4py.save_vis_petri_net(net, im, fm, 'inductive_model.svg')
        
        # Read SVG content
        with open('inductive_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('inductive_model.svg')
        
        # Calculate conformance metrics
        tbr_fit = pm4py.fitness_token_based_replay(log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(log, net, im, fm)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(log, net, im, fm)
            align_prec = pm4py.precision_alignments(log, net, im, fm)
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
        
        # Simplicity measure using the formula:
        # Simplicity_log = (|A| / |T|) * (1 / (1 + (|P| + |F|) / (|E| + |C|)))
        # Where:
        # |A|: number of distinct activities in the log
        # |E|: total number of events in the log
        # |C|: number of cases in the log
        # |P|: number of places in the Petri net
        # |T|: number of transitions
        # |F|: number of arcs
        
        # Get log statistics
        num_activities = len(log['concept:name'].unique())  # |A|
        num_events = len(log)  # |E|
        num_cases = len(log['case:concept:name'].unique())  # |C|
        
        # Get Petri net statistics
        num_transitions = len(net.transitions)  # |T|
        num_places = len(net.places)  # |P|
        num_arcs = len(net.arcs)  # |F|
        
        # Calculate simplicity
        if num_transitions > 0:
            activity_transition_ratio = num_activities / num_transitions
            complexity_factor = (num_places + num_arcs) / (num_events + num_cases)
            simplicity = activity_transition_ratio * (1 / (1 + complexity_factor))
        else:
            simplicity = 0
        
        return {
            "message": "Inductive algorithm discovery completed",
            "svg_content": svg_content,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "simplicity": simplicity,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Inductive discovery: {str(e)}",
            "status": "error"
        }

@app.post("/api/upload_model")
async def upload_model(file: UploadFile = File(...)):
    """Upload Petri net or BPMN model and store it globally"""
    global model
    
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
                model = pm4py.read_pnml(temp_file_path)
            elif file.filename.endswith('.bpmn'):
                # Read BPMN model
                model = pm4py.read_bpmn(temp_file_path)
            else:
                return {
                    "message": "Unsupported file format. Please upload .pnml or .bpmn files.",
                    "status": "error"
                }
            
            # Save as SVG
            if file.filename.endswith('.pnml'):
                # For Petri nets, save directly
                pm4py.save_vis_petri_net(model[0], model[1], model[2], 'model.svg')
            elif file.filename.endswith('.bpmn'):
                # For BPMN, convert to Petri net first, then save
                net, im, fm = pm4py.convert_to_petri_net(model)
                pm4py.save_vis_petri_net(net, im, fm, 'model.svg')
            
            # Read the SVG content
            with open('model.svg', 'r', encoding='utf-8') as svg_file:
                svg_content = svg_file.read()
            
            # Delete temporary SVG file
            os.unlink('model.svg')
            
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

@app.post("/api/conformance")
async def conformance():
    """Perform conformance checking between uploaded log and model"""
    global log, model
    
    if log is None:
        return {"message": "No event log uploaded. Please upload a log first.", "status": "error"}
    
    if model is None:
        return {"message": "No model uploaded. Please upload a model first.", "status": "error"}
    
    try:
        # Convert BPMN to Petri net if needed
        if isinstance(model, tuple) and len(model) == 3:
            # Already a Petri net (net, im, fm)
            net, im, fm = model
        else:
            # BPMN model, convert to Petri net
            net, im, fm = pm4py.convert_to_petri_net(model)
        
        # Calculate conformance metrics
        tbr_fit = pm4py.fitness_token_based_replay(log, net, im, fm)
        tbr_prec = pm4py.precision_token_based_replay(log, net, im, fm)
        
        # Try to calculate alignment metrics, handle non-sound Petri nets
        try:
            align_fit = pm4py.fitness_alignments(log, net, im, fm)
            align_prec = pm4py.precision_alignments(log, net, im, fm)
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
        
        # Simplicity measure using the formula:
        # Simplicity_log = (|A| / |T|) * (1 / (1 + (|P| + |F|) / (|E| + |C|)))
        # Where:
        # |A|: number of distinct activities in the log
        # |E|: total number of events in the log
        # |C|: number of cases in the log
        # |P|: number of places in the Petri net
        # |T|: number of transitions
        # |F|: number of arcs
        
        # Get log statistics
        num_activities = len(log['concept:name'].unique())  # |A|
        num_events = len(log)  # |E|
        num_cases = len(log['case:concept:name'].unique())  # |C|
        
        # Get Petri net statistics
        num_transitions = len(net.transitions)  # |T|
        num_places = len(net.places)  # |P|
        num_arcs = len(net.arcs)  # |F|
        
        # Calculate simplicity
        if num_transitions > 0:
            activity_transition_ratio = num_activities / num_transitions
            complexity_factor = (num_places + num_arcs) / (num_events + num_cases)
            simplicity = activity_transition_ratio * (1 / (1 + complexity_factor))
        else:
            simplicity = 0
        
        # Generate SVG visualization
        pm4py.save_vis_petri_net(net, im, fm, 'conformance_model.svg')
        
        # Read SVG content
        with open('conformance_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('conformance_model.svg')
        
        return {
            "message": "Conformance checking completed",
            "svg_content": svg_content,
            "tbr_fitness": tbr_fitness,
            "align_fitness": align_fitness_value,
            "tbr_precision": tbr_precision,
            "align_precision": align_precision_value,
            "tbr_f1": tbr_f1,
            "align_f1": align_f1,
            "mean_fitness": mean_fitness,
            "mean_precision": mean_precision,
            "simplicity": simplicity,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in conformance checking: {str(e)}",
            "status": "error"
        }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)