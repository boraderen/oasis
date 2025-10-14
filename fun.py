import numpy as np
import pandas as pd
import pm4py

flattened_log = pd.DataFrame([
    ["e1", "1980-01-01 00:00:00", "Create Order", "ciao", 456.0, "i1", "element", "due", 2.0],
    ["e1", "1980-01-01 00:00:00", "Create Order", "ciao", 456.0, "i2", "element", "tre", 3.0],
    ["e1", "1980-01-01 00:00:00", "Create Order", "ciao", 456.0, "i3", "element", "quattro", 4.0],
    ["e1", "1980-01-03 00:00:00", "Item out of Stock", np.nan, np.nan, "i3", "element", "quattro", 4.0],
    ["e4", "1980-01-04 00:00:00", "Create Delivery", np.nan, np.nan, "i2", "element", "due", 2.0],
    ["e4", "1980-01-05 00:00:00", "Item back in Stock", np.nan, np.nan, "i3", "element", "quattro", 4.0],
    ["e6", "1981-01-01 00:00:00", "Create Order", np.nan, np.nan, "i1", "element", "due", 2.0],
    ["e10", "1981-01-02 00:00:00", "Remove Item", np.nan, np.nan, "i5", "element", np.nan, np.nan],
    ["e12", "1981-01-04 00:00:00", "Create Order", np.nan, np.nan, "i8", "element", np.nan, np.nan],
    ["e14", "1981-01-04 00:00:00", "Create Order", np.nan, np.nan, "i7", "element", np.nan, np.nan],
    ["e15", "1981-01-05 00:00:00", "Add Item to Order", np.nan, np.nan, "i9", "element", np.nan, np.nan],
    ["e16", "1981-01-06 00:00:00", "Create Delivery", np.nan, np.nan, "i3", "element", "quattro", 4.0],
    ["e16", "1981-01-06 00:00:00", "Create Delivery", np.nan, np.nan, "i4", "element", "tre", 3.0],
    ["e16", "1981-01-06 00:00:00", "Create Delivery", np.nan, np.nan, "i7", "element", np.nan, np.nan],
    ["e16", "1981-01-06 00:00:00", "Create Delivery", np.nan, np.nan, "i8", "element", np.nan, np.nan],
    ["e17", "1981-01-07 00:00:00", "Create Delivery", np.nan, np.nan, "i9", "element", np.nan, np.nan],
    ["e18", "1981-01-08 00:00:00", "Create Delivery", np.nan, np.nan, "i1", "element", np.nan, np.nan],
    ["e18", "1981-01-08 00:00:00", "Create Delivery", np.nan, np.nan, "i3", "element", np.nan, np.nan],
    ["e18", "1981-01-08 00:00:00", "Create Delivery", np.nan, np.nan, "i4", "element", np.nan, np.nan],
], columns=[
    "ocel:eid",
    "time:timestamp",
    "concept:name",
    "prova",
    "prova2",
    "case:concept:name",
    "case:ocel:type",
    "case:oattr1",
    "case:oattr2"
])

flattened_log["time:timestamp"] = pd.to_datetime(flattened_log["time:timestamp"])

pm4py.write_xes(flattened_log, 'llog.xes')