"""OCPM Discovery router for Object-Centric Process Mining discovery algorithms."""
from fastapi import APIRouter, Form
import pm4py
import os

from models import state

router = APIRouter()


@router.post("/api/discover_ocpm_im")
async def discover_ocpm_im(ocel_index: int = Form(...)):
    """Discover Object-Centric Petri net using Inductive Miner (IM) variant"""
    try:
        # Validate OCEL index
        if ocel_index < 0 or ocel_index >= len(state.ocels):
            return {
                "message": f"Invalid OCEL index: {ocel_index}",
                "status": "error"
            }
        
        # Get the selected OCEL
        ocel_entry = state.ocels[ocel_index]
        ocel = ocel_entry["ocel_object"]
        
        # Discover Object-Centric Petri net using IM variant
        model = pm4py.discover_oc_petri_net(ocel, diagnostics_with_tbr=True, inductive_miner_variant='im')
        
        # Save as SVG
        pm4py.save_vis_ocpn(model, 'ocpm_im_model.svg')
        
        # Read SVG content
        with open('ocpm_im_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('ocpm_im_model.svg')
        
        return {
            "message": "OCPM IM algorithm discovery completed",
            "svg_content": svg_content,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in OCPM IM discovery: {str(e)}",
            "status": "error"
        }


@router.post("/api/discover_ocpm_imd")
async def discover_ocpm_imd(ocel_index: int = Form(...)):
    """Discover Object-Centric Petri net using Inductive Miner Directly-Follows (IMD) variant"""
    try:
        # Validate OCEL index
        if ocel_index < 0 or ocel_index >= len(state.ocels):
            return {
                "message": f"Invalid OCEL index: {ocel_index}",
                "status": "error"
            }
        
        # Get the selected OCEL
        ocel_entry = state.ocels[ocel_index]
        ocel = ocel_entry["ocel_object"]
        
        # Discover Object-Centric Petri net using IMD variant
        model = pm4py.discover_oc_petri_net(ocel, diagnostics_with_tbr=True, inductive_miner_variant='imd')
        
        # Save as SVG
        pm4py.save_vis_ocpn(model, 'ocpm_imd_model.svg')
        
        # Read SVG content
        with open('ocpm_imd_model.svg', 'r', encoding='utf-8') as svg_file:
            svg_content = svg_file.read()
        
        # Delete temporary SVG file
        os.unlink('ocpm_imd_model.svg')
        
        return {
            "message": "OCPM IMD algorithm discovery completed",
            "svg_content": svg_content,
            "status": "success"
        }
        
    except Exception as e:
        return {
            "message": f"Error in OCPM IMD discovery: {str(e)}",
            "status": "error"
        }