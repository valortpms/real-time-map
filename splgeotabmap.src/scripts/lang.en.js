/* eslint-disable */
if (typeof window.splgeotabmap == "undefined") {
  window.splgeotabmap = {
    lang: {}
  };
}
window.splgeotabmap.lang.en = {

  "reset_btn_desc":                     "Flush display of ALL SpartanLync sensor data and Reload",
  "reset_btn_title":                    "Reset",
  "reset_btn_msg":                      "SENSOR DATA HAS BEEN RESET",
  "reset_failed_busy":                  "Cannot Reset while a sensor data search is in progress..Please try again later.",

  "veh_comp_tractor":                   "Tractor",
  "veh_comp_trailer1":                  "Trailer 1",
  "veh_comp_dolly":                     "Dolly",
  "veh_comp_trailer2":                  "Trailer 2",

  "sensors_not_found":                  "No Sensors Found",
  "sensors_tooltip_searching_msg":      "Searching for SpartanLync Sensors...",
  "sensors_tooltip_found_msg":          "SpartanLync sensors detected",
  "sensors_tooltip_found_menuitem_msg": "( Click 'Show SpartanLync Sensors' for more details in THE RIGHT-SIDE PANEL ===> )",
  "sensors_tooltip_not_found_msg":      "SpartanLync Sensors Not Found",
  "sensors_tooltip_comp_found_msg":     "Additional Sensors Found On",
  "sensors_menuitm_searching_msg":      "Searching [ <b>{veh}</b> ]<br />for Temptrac / TPMS Sensors...<br />Please wait until you see SpartanLync Sensor search results on the Vehicle Map tooltip",
  "sensors_menuitm_not_Found_msg":      "No Temptrac / TPMS Sensors Found on Vehicle [ <b>{veh}</b> ]",

  "map_menuitm_label":                  "Show SpartanLync Sensors",
  "map_menuitm_watchlist_add":          "Add to SpartanLync Watchlist",
  "map_menuitm_watchlist_remove":       "Remove from SpartanLync Watchlist",
  "panel_btn_close_title":              "Close",
  "panel_title":                        "SpartanLync Sensors For:",
  "panel_sensor_timestamp":             "Sensor Timestamp",
  "panel_last_reading":                 "Last Reading",
  "panel_switchto_spltools_instruction":"View In SpartanLync Tools",
  "panel_user_instruction":             "Hover over or click on a vehicle to view the latest SpartanLync sensor information",
  "panel_search_busy_msg":              "BUSY",
  "panel_veh_jump_widget_title":        "Jump To Vehicle",

  "error_title":                        "Error",
  "error_app_title":                    "SplGeotabMap Error",
  "error_startup_general":              "getSplSettings() FAILED:",
  "error_failed_saving_watchlist":      "saveWatchlist() FAILED:",
  "error_startup_nosettings":           "Invalid or missing SpartanLync Tools/Map Settings",
  "error_startup_nosplmap":             "Missing SpartanLync Map configuration.<br />Please run Spartanlync Map first",
  "error_startup_nospltools":           "Missing SpartanLync Tools configuration.<br />Please run Spartanlync Tools first",
  "error_spltools_switch_failed":       "Failed switching to SpartanLync Tools:",
  "error_spltools_switch_noprivsfound": "SplMap Error: Your MyGeotab Account does not have sufficient permissions to allow switching to SpartanLync Tools...Please run SpartanLync Tools manually.",
  "error_spltools_switch_getnoprivs":   "Failed to get MyGeotab permissions for switching to SpartanLync Tools:",

  "about_appname":                      "SpartanLync MyGeotab Map",
  "about_instruction":                  "Use SpartanLync Tools to change the above settings",
  "about_timezone":                     "Date & Time Timezone",
  "about_refresh":                      "Sensor Info Refresh Rate",
  "about_lang":                         "Language",
  "about_buildver":                     "Build Version",
  "about_builddate":                    "Build Date",
  "about_unknown":                      "UnKnown",

  // Fault Alerts
  "alert_tooltip":                      "{alert_msg}<br />on<br />{timestamp}",
  "alert_header":                       "Post-Ignition Alert",
  "alert_sensor_location_header":       "Sensor Location",
  "alert_missing_sensor":               "Missing Sensor",
  "alert_temperature_over":             "Over Temperature",
  "alert_pressure_extreme_over":        "Extreme Over Pressure",
  "alert_pressure_extreme_under":       "Extreme Under Pressure",
  "alert_pressure_over":                "Over Pressure",
  "alert_pressure_under":               "Under Pressure",
  "alert_battery_low_voltage":          "Vehicle Battery has LOW Voltage",
  "alert_tire_temperature_fault":       "Tire Temperature Fault",
  "alert_tire_pressure_fault":          "Tire Pressure Fault",
  "alert_desc_zone":                    "Zone",
  "alert_desc_axle":                    "Axle",
  "alert_desc_tire":                    "Tire",
  "alert_desc_tractor":                 "Tractor",
  "alert_desc_trailer":                 "Trailer",
  "alert_desc_dolly":                   "Dolly",
  "alert_tooltip_instruction_msg":      "( Click for more details on THE RIGHT-SIDE PANEL ===> )",

}
