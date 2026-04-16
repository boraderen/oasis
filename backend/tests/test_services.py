from __future__ import annotations

import json
import unittest
from pathlib import Path

from backend.app.services.autopm import run_autopm
from backend.app.services.conformance import compute_custom_alignment, conformance_log_log, conformance_log_model
from backend.app.services.dfg import update_log_dfg
from backend.app.services.discovery import discover_process_model
from backend.app.services.logs import build_log_exploration
from backend.app.services.ocel import discover_ocpm, explore_ocel, flatten_ocel_to_event_log


ROOT = Path(__file__).resolve().parents[2]
LOG_PATH = str(ROOT / "logs" / "event-log.xes")
MODEL_PATH = str(ROOT / "models" / "normative-model.pnml")
OCEL_PATH = str(ROOT / "logs" / "order_process.jsonocel")


class ServiceSmokeTests(unittest.TestCase):
    def test_log_exploration_returns_expected_artifacts(self) -> None:
        result = build_log_exploration(LOG_PATH, "event-log.xes")

        self.assertEqual(result["status"], "success")
        self.assertIn("regular_svg_content", result)
        self.assertIn("performance_svg_content", result)
        self.assertTrue(result["available_activities"])
        self.assertTrue(result["available_variants"])
        self.assertIn("footprint_matrix", result)
        self.assertIn("regular_dfg", result["insights"])
        self.assertIn("performance_dfg", result["insights"])
        self.assertTrue(result["insights"]["trace_variants"][0]["edge_performance"][0]["samples"])
        self.assertTrue(result["visualization_data"]["event_points"])
        self.assertTrue(result["visualization_data"]["case_durations"])

    def test_dfg_update_supports_top_k_and_manual_modes(self) -> None:
        exploration = build_log_exploration(LOG_PATH, "event-log.xes")
        available_activities = exploration["available_activities"]

        top_k = update_log_dfg(
            LOG_PATH,
            selected_activities=available_activities,
            variant_mode="top_k",
            selected_variants=[],
            top_variant_percentage=50,
        )

        self.assertEqual(
            set(top_k.keys()),
            {
                "message",
                "regular_svg_content",
                "performance_svg_content",
                "available_variants",
                "filtered_case_count",
                "filtered_event_count",
                "kept_variant_count",
                "status",
            },
        )
        self.assertGreaterEqual(top_k["kept_variant_count"], 1)

        first_variant = [top_k["available_variants"][0]["activities"]]
        manual = update_log_dfg(
            LOG_PATH,
            selected_activities=available_activities,
            variant_mode="manual",
            selected_variants=first_variant,
            top_variant_percentage=None,
        )

        self.assertEqual(manual["status"], "success")
        self.assertEqual(manual["kept_variant_count"], 1)
        self.assertLessEqual(manual["filtered_event_count"], exploration["insights"]["num_events"])

    def test_discovery_and_conformance_smoke(self) -> None:
        discovery = discover_process_model(LOG_PATH, "event-log.xes", "inductive", {"noise_threshold": 0.2})
        self.assertEqual(discovery["status"], "success")
        self.assertTrue(discovery["svg_content"])
        self.assertTrue(discovery["bpmn_svg_content"])
        self.assertTrue(discovery["bpmn_content"])
        self.assertTrue(discovery["pnml_content"])

        log_log = conformance_log_log(LOG_PATH, "event-log.xes", LOG_PATH, "event-log.xes")
        self.assertIn("log1_insights", log_log)
        self.assertIn("log2_insights", log_log)

        conformance = conformance_log_model(LOG_PATH, "event-log.xes", MODEL_PATH, "normative-model.pnml")
        self.assertEqual(conformance["status"], "success")
        self.assertIn("alignment_data", conformance)
        self.assertIn("log_insights", conformance)
        self.assertTrue(conformance["model_bpmn_svg"])
        self.assertTrue(conformance["model_bpmn_content"])

        first_variant = build_log_exploration(LOG_PATH, "event-log.xes")["available_variants"][0]["activities"]
        custom = compute_custom_alignment(LOG_PATH, MODEL_PATH, first_variant)
        self.assertIn("alignment", custom)
        self.assertIn("tbr", custom)

    def test_ocel_and_autopm_smoke(self) -> None:
        ocel = explore_ocel(OCEL_PATH, "order_process.jsonocel")
        self.assertEqual(ocel["status"], "success")
        self.assertTrue(ocel["ocdfg_svg_content"])
        first_object_type = ocel["object_types"][0]
        self.assertTrue(ocel["object_type_data"][first_object_type]["visualization_data"]["event_points"])

        ocpm = discover_ocpm(OCEL_PATH, "order_process.jsonocel", "im")
        self.assertEqual(ocpm["status"], "success")
        self.assertTrue(ocpm["svg_content"])
        self.assertTrue(ocpm["ocpn_content"])
        self.assertEqual(json.loads(ocpm["ocpn_content"])["format"], "oasis-ocpn-json")

        flattened = flatten_ocel_to_event_log(OCEL_PATH, "order_process.jsonocel", first_object_type)
        self.assertEqual(flattened["status"], "success")
        self.assertIn("xes_content", flattened)
        self.assertIn("<log", flattened["xes_content"])

        autopm = run_autopm(
            LOG_PATH,
            "event-log.xes",
            selected_algorithms=["alpha"],
            search_space_technique="grid",
            optimization_rounds=1,
            cross_validation_folds=2,
            optimization_metric="f1",
        )
        self.assertEqual(autopm["status"], "success")
        self.assertEqual(len(autopm["leaderboard"]), 1)


if __name__ == "__main__":
    unittest.main()
