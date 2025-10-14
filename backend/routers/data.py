"""Data router for uploading and managing logs and models."""
from fastapi import APIRouter, File, UploadFile
import pandas as pd
import pm4py
import tempfile
import os
import datetime

from models import state

router = APIRouter()


@router.post("/api/upload_log")
async def upload_log(file: UploadFile = File(...)):
    """Upload event log and append to logs list"""
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
            
            # Capture original columns (before PM4Py adds any processing columns)
            # We need to filter out PM4Py-added columns like 'start_timestamp' if they weren't in the original file
            # Standard XES/event log columns that should always be kept
            standard_columns = ['case:concept:name', 'concept:name', 'time:timestamp', 'org:resource']
            original_columns = []
            for col in event_log.columns:
                # Keep standard columns and any custom columns
                # Exclude 'start_timestamp' if it equals 'time:timestamp' (PM4Py added it)
                if col == 'start_timestamp':
                    # Check if it's identical to time:timestamp (PM4Py added it)
                    if 'time:timestamp' in event_log.columns:
                        if event_log['start_timestamp'].equals(event_log['time:timestamp']):
                            continue  # Skip this PM4Py-added column
                original_columns.append(col)
            
            # Append to logs list with both metadata and log object
            state.logs.append({
                "metadata": {
                    "filename": file.filename,
                    "uploaded_at": datetime.datetime.now().isoformat(),
                    "num_events": len(event_log),
                    "num_cases": len(event_log['case:concept:name'].unique()),
                    "num_activities": len(event_log['concept:name'].unique()),
                    "original_columns": original_columns
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


@router.post("/api/upload_model")
async def upload_model(file: UploadFile = File(...)):
    """Upload Petri net or BPMN model and append to models list"""
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
            state.model = uploaded_model
            
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
            state.models.append({
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


@router.get("/api/logs")
async def get_logs():
    """Get list of uploaded event logs (metadata only)"""
    # Return only metadata, not the log objects
    logs_metadata = [log_entry["metadata"] for log_entry in state.logs]
    return {
        "logs": logs_metadata,
        "count": len(logs_metadata),
        "status": "success"
    }


@router.get("/api/models")
async def get_models():
    """Get list of uploaded models (metadata only)"""
    # Return only metadata, not the model objects
    models_metadata = [model_entry["metadata"] for model_entry in state.models]
    return {
        "models": models_metadata,
        "count": len(models_metadata),
        "status": "success"
    }


@router.delete("/api/delete_log/{index}")
async def delete_log(index: int):
    """Delete an event log from the logs list by index"""
    try:
        if 0 <= index < len(state.logs):
            deleted_log = state.logs.pop(index)
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


@router.delete("/api/delete_model/{index}")
async def delete_model(index: int):
    """Delete a model from the models list by index"""
    try:
        if 0 <= index < len(state.models):
            deleted_model = state.models.pop(index)
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


@router.post("/api/upload_ocel")
async def upload_ocel(file: UploadFile = File(...)):
    """Upload OCEL (Object-Centric Event Log) and append to ocels list"""
    try:
        # Read uploaded file
        content = await file.read()
        
        if not file.filename:
            return {"message": "No file provided", "status": "error"}
        
        # Save file temporarily
        file_extension = file.filename.split('.')[-1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=f".{file_extension}") as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Read the OCEL using PM4Py
            if file.filename.endswith('.jsonocel') or file.filename.endswith('.json'):
                ocel = pm4py.read_ocel(temp_file_path)
            elif file.filename.endswith('.xmlocel') or file.filename.endswith('.xml'):
                ocel = pm4py.read_ocel(temp_file_path)
            elif file.filename.endswith('.csv'):
                # For CSV files, try to read as OCEL
                ocel = pm4py.read_ocel_csv(temp_file_path)
            else:
                return {
                    "message": "Unsupported file format. Please upload .jsonocel, .xmlocel, or .csv files.",
                    "status": "error"
                }
            
            # Get OCEL statistics
            num_events = len(ocel.events)
            num_objects = len(ocel.objects)
            object_types = list(ocel.objects['ocel:type'].unique()) if 'ocel:type' in ocel.objects.columns else []
            
            # Append to ocels list with both metadata and OCEL object
            state.ocels.append({
                "metadata": {
                    "filename": file.filename,
                    "uploaded_at": datetime.datetime.now().isoformat(),
                    "num_events": num_events,
                    "num_objects": num_objects,
                    "object_types": object_types
                },
                "ocel_object": ocel
            })
            
            return {
                "message": f"OCEL successfully uploaded and processed: {file.filename}",
                "filename": file.filename,
                "status": "success"
            }
            
        except Exception as e:
            return {
                "message": f"Error processing OCEL: {str(e)}",
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


@router.get("/api/ocels")
async def get_ocels():
    """Get list of uploaded OCELs (metadata only)"""
    # Return only metadata, not the OCEL objects
    ocels_metadata = [ocel_entry["metadata"] for ocel_entry in state.ocels]
    return {
        "ocels": ocels_metadata,
        "count": len(ocels_metadata),
        "status": "success"
    }


@router.delete("/api/delete_ocel/{index}")
async def delete_ocel(index: int):
    """Delete an OCEL from the ocels list by index"""
    try:
        if 0 <= index < len(state.ocels):
            deleted_ocel = state.ocels.pop(index)
            return {
                "message": f"Successfully deleted OCEL: {deleted_ocel['metadata']['filename']}",
                "status": "success"
            }
        else:
            return {
                "message": f"Invalid index: {index}. No OCEL found at this position.",
                "status": "error"
            }
    except Exception as e:
        return {
            "message": f"Error deleting OCEL: {str(e)}",
            "status": "error"
        }

