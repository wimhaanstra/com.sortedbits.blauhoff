## Growatt 3PH MOD TL3-X series
Three phase Growatt string inverter.

### Input Registers Inverter
| Address | Length | Data Type | Unit | Scale | Tranformation | Capability ID | Capability name | Range | DeviceTypes |
| ------- | ------ | --------- | ---- | ----- | ------------- | ------------- | --------------- | ----- | ----------- |
| 0| 1| UINT8| | -| No| status_code.run_mode| Run mode| -| Inverter |
| 1| 2| UINT32| W| 0.1| No| measure_power.ac| AC power| -| Inverter |
| 3| 2| UINT16| V| 0.1| No| measure_voltage.pv1| PV 1 voltage| 0 - 360| Inverter |
| 5| 2| UINT32| W| 0.1| No| measure_power.pv1| PV 1 power| 0 - 20000| Inverter |
| 7| 2| UINT16| V| 0.1| No| measure_voltage.pv2| PV 2 voltage| 0 - 360| Inverter |
| 9| 2| UINT32| W| 0.1| No| measure_power.pv2| PV 2 power| 0 - 20000| Inverter |
| 35| 2| UINT32| W| 0.1| No| measure_power| Power| 0 - 40000| Inverter |
| 38| 2| UINT16| V| 0.1| No| measure_voltage.grid_l1| Grid L1 voltage| 0 - 300| Inverter |
| 42| 2| UINT16| V| 0.1| No| measure_voltage.grid_l2| Grid L2 voltage| 0 - 300| Inverter |
| 46| 2| UINT16| V| 0.1| No| measure_voltage.grid_l3| Grid L3 voltage| 0 - 300| Inverter |
| 53| 2| UINT32| kWh| 0.1| No| meter_power.today| Today| 0 - 100| Inverter |
| 55| 2| UINT32| kWh| 0.1| No| meter_power| Energy| >= 0.1| Inverter |
### Holding Registers Inverter
| Address | Length | Data Type | Unit | Scale | Tranformation | Capability ID | Capability name | Range | DeviceTypes |
| ------- | ------ | --------- | ---- | ----- | ------------- | ------------- | --------------- | ----- | ----------- |
| 23| 5| STRING| | -| No| serial| Serial number| -| Inverter |

