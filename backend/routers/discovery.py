"""Discovery router for process discovery algorithms."""
from fastapi import APIRouter, Form
import pm4py
import os

from models import state
from utils.helpers import get_log_insights

router = APIRouter()


def calculate_conformance_metrics(test_log, net, im, fm, log_metadata, train_stats, test_stats):
    """Helper function to calculate conformance metrics for discovered models"""
    # Calculate conformance metrics on test data
    tbr_fit = pm4py.fitness_token_based_replay(test_log, net, im, fm)
    tbr_prec = pm4py.precision_token_based_replay(test_log, net, im, fm)
    
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
    }


@router.post("/api/discover_alpha")
async def discover_alpha(log_index: int = Form(...)):
    """Discover Petri net using Alpha algorithm with train/test split"""
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(state.logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = state.logs[log_index]
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
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Calculate conformance metrics
        metrics = calculate_conformance_metrics(test_log, net, im, fm, log_metadata, train_stats, test_stats)
        
        return {
            "message": "Alpha algorithm discovery completed",
            "svg_content": svg_content,
            **metrics,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Alpha discovery: {str(e)}",
            "status": "error"
        }


@router.post("/api/discover_ilp")
async def discover_ilp(log_index: int = Form(...), alpha: float = Form(0.5)):
    """Discover Petri net using ILP algorithm with train/test split"""
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(state.logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = state.logs[log_index]
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
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Calculate conformance metrics
        metrics = calculate_conformance_metrics(test_log, net, im, fm, log_metadata, train_stats, test_stats)
        
        return {
            "message": "ILP algorithm discovery completed",
            "svg_content": svg_content,
            **metrics,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in ILP discovery: {str(e)}",
            "status": "error"
        }


@router.post("/api/discover_heuristics")
async def discover_heuristics(
    log_index: int = Form(...),
    dependency_threshold: float = Form(0.9),
    and_threshold: float = Form(0.9),
    loop_two_threshold: float = Form(0.9)
):
    """Discover Petri net using Heuristics algorithm with train/test split"""
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(state.logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = state.logs[log_index]
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
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Calculate conformance metrics
        metrics = calculate_conformance_metrics(test_log, net, im, fm, log_metadata, train_stats, test_stats)
        
        return {
            "message": "Heuristics algorithm discovery completed",
            "svg_content": svg_content,
            **metrics,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Heuristics discovery: {str(e)}",
            "status": "error"
        }


@router.post("/api/discover_inductive")
async def discover_inductive(log_index: int = Form(...), noise_threshold: float = Form(0.2)):
    """Discover Petri net using Inductive algorithm with train/test split"""
    try:
        # Validate log index
        if log_index < 0 or log_index >= len(state.logs):
            return {
                "message": f"Invalid log index: {log_index}",
                "status": "error"
            }
        
        # Get the selected log
        log_entry = state.logs[log_index]
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
        
        # Get train and test log statistics
        train_stats = get_log_insights(train_log)
        test_stats = get_log_insights(test_log)
        
        # Calculate conformance metrics
        metrics = calculate_conformance_metrics(test_log, net, im, fm, log_metadata, train_stats, test_stats)
        
        return {
            "message": "Inductive algorithm discovery completed",
            "svg_content": svg_content,
            **metrics,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in Inductive discovery: {str(e)}",
            "status": "error"
        }

