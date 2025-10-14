"""Helper functions for log processing and analysis."""
import statistics
import pm4py


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


def count_footprint_differences(fp1, fp2):
    """Count differences between two footprints"""
    seq1 = fp1.get('sequence', set())
    seq2 = fp2.get('sequence', set())
    par1 = fp1.get('parallel', set())
    par2 = fp2.get('parallel', set())
    
    # Count symmetric differences
    diff_count = len(seq1.symmetric_difference(seq2))
    diff_count += len(par1.symmetric_difference(par2))
    
    return diff_count

