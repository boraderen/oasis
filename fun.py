import pm4py
import pm4py_ext

log = pm4py.read_xes('logs/event-log.xes')

dfg, start_activities, end_activities = pm4py.discover_dfg(log)
filtered_dfg, filtered_start, filtered_end = pm4py.filter_dfg_activities_percentage(
    dfg, start_activities, end_activities, percentage=0.2
)
pm4py.view_dfg(filtered_dfg, filtered_start, filtered_end)


dfg, start_activities, end_activities = pm4py.discover_performance_dfg(log)

filtered_dfg, filtered_start, filtered_end = pm4py_ext.filter_performance_dfg_activities_percentage(
    dfg, start_activities, end_activities, percentage=0.2
)
pm4py.view_performance_dfg(filtered_dfg, filtered_start, filtered_end)