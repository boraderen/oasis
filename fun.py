import pm4py
import pandas as pd

log = pm4py.read_xes('logs/event-log.xes')
net, im, fm = pm4py.discover_petri_net_inductive(log, noise_threshold=0)

# Get variants
variants = pm4py.get_variants(log)

# Get one trace per variant
variant_traces = []
case_to_variant = {}

for case_group in log.groupby('case:concept:name', sort=False):
    case_id = case_group[0]
    case_events = case_group[1]
    variant_tuple = tuple(case_events['concept:name'].tolist())
    case_to_variant[case_id] = variant_tuple
    
    # If this variant hasn't been added yet, add this case
    if variant_tuple not in [v for v, _ in variant_traces]:
        variant_traces.append((variant_tuple, case_events))

print(f"Total variants: {len(variants)}")
print(f"Unique traces collected: {len(variant_traces)}")

# Create a log with only one trace per variant
variant_log_df = pd.concat([case_events for _, case_events in variant_traces], ignore_index=True)
variant_log = pm4py.convert_to_event_log(variant_log_df)

print(f"Variant log created")

# Get alignments for the variant log
alignments = pm4py.conformance.conformance_diagnostics_alignments(variant_log, net, im, fm)

print(f"Total alignments: {len(alignments)}")

# Build result
alignment_data = []
for idx, (variant, count) in enumerate(list(variants.items())[:20]):
    variant_key = variant if isinstance(variant, tuple) else tuple(variant.split(','))
    
    if idx < len(alignments):
        alignment_data.append({
            'variant': list(variant_key),
            'frequency': count,
            'alignment': alignments[idx]['alignment'],
            'fitness': alignments[idx]['fitness'],
            'cost': alignments[idx]['cost']
        })

print(f"\nAlignment data: {len(alignment_data)} variants")
if len(alignment_data) > 0:
    print(f"First variant: {alignment_data[0]['variant']}")
    print(f"First alignment: {alignment_data[0]['alignment']}")
