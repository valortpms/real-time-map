/* eslint-disable */
if (typeof window.splmap == "undefined") {
  window.splmap = {
    lang: {}
  };
}
window.splmap.lang.en = {

  "veh_comp_tractor":                              "Tractor",
  "veh_comp_trailer1":                             "Trailer 1",
  "veh_comp_dolly":                                "Dolly",
  "veh_comp_trailer2":                             "Trailer 2",

  "sensor_search_busy_msg":                        "BUSY",
  "sensor_search_busy_getting_data_msg":           "Getting Data",
  "sensor_search_last_reading":                    "Last Reading",
  "sensor_search_back_in_time":                    "Travelling Back In Time",
  "sensor_search_sensor_timestamp":                "Sensor Timestamp",
  "sensor_search_switchto_spltools_instruction":   "View In SpartanLync Tools",
  "sensor_search_status_data_msg":                 "Status Data",

  "splmap_rule_name_label":                        "Rule Name",
  "splmap_alert_header":                           "SpartanLync Alert",
  "splmap_service_started":                        "SpartanLync Map Service Started Successfully",
  "splmap_service_failed":                         "SpartanLync Map Service Startup Failed",
  "splmap_veh_flying_msg":                         "Flying To Vehicle<br />'{veh}'",
  "splmap_veh_flying_loading_gps":                 "Loading Vehicle GPS Data",
  "splmap_veh_flying_loading_gps_subtitle":        "for Flying....",
  "splmap_vehpanel_component_title":               "Vehicle Components",
  "splmap_vehpanel_splsensors_btn_tooltip":        "View SpartanLync Sensor Data for this Vehicle",

  "splmap_tooltip_map_add_veh_tofilter":           "Add Device to Vehicle Filter",
  "splmap_tooltip_vehtab_veh_flyto":               "Fly to Vehicle on Map",
  "splmap_tooltip_vehtab_veh_remove":              "Remove this Vehicle from Panel",
  "splmap_tooltip_vehtab_veh_hideshow":            "Hide/Show Vehicle on Map",
  "splmap_tooltip_vehtab_toggle_all":              "Toggle All Vehicles/Groups",
  "splmap_tooltip_vehtab_delete_all":              "Remove All Vehicles/Groups from Panel",
  "splmap_tooltip_statustab_toggle_all":           "Toggle All Statuses",
  "splmap_tooltip_statustab_delete_all":           "Delete All Statuses",
  "splmap_tooltip_statustab_status_hideshow":      "Hide/Show Status",
  "splmap_tooltip_statustab_status_remove":        "Remove this Status",
  "splmap_tooltip_exceptiontab_exception_remove":  "Remove this Exception",
  "splmap_tooltip_exceptiontab_exception_hideshow":"Hide/Show Exception",
  "splmap_tooltip_exceptiontab_toggle_all":        "Toggle All Exceptions",
  "splmap_tooltip_exceptiontab_delete_all":        "Delete All Exceptions",
  "splmap_tooltip_configpanel_open":               "Open Configuration Panel",
  "splmap_tooltip_configpanel_close":              "Close Configuration Panel",
  "splmap_configpanel_search":                     "Search...",
  "splmap_configpanel_vehtab_title":               "Vehicles",
  "splmap_configpanel_vehtab_list_label":          "Selected Vehicles",
  "splmap_configpanel_statustab_title":            "Status",
  "splmap_configpanel_statustab_list_label":       "Selected Status",
  "splmap_configpanel_exceptiontab_title":         "Exceptions",
  "splmap_configpanel_exceptiontab_list_label":    "Selected Exceptions",
  "splmap_controlspanel_label_live":               "LIVE",
  "splmap_controlspanel_label_live_help":          "( Click to revert back to LIVE )",
  "splmap_controlspanel_label_speed":              "Speed",
  "splmap_controlspanel_label_speed_tooltip":      "Playback Speed Menu (Speed cannot be changed when Live)",
  "splmap_controlspanel_label_date":               "Date",
  "splmap_controlspanel_label_time_start":         "Start Time",
  "splmap_controlspanel_label_time_current":       "Current Time",
  "splmap_controlspanel_label_apply_changes_btn":  "Apply",
  "splmap_controlspanel_tooltip_play":             "Play",
  "splmap_controlspanel_tooltip_pause":            "Pause",
  "splmap_controlspanel_group":                    "Group",
  "splmap_map_zoom_in":                            "Zoom in",
  "splmap_map_zoom_out":                           "Zoom out",

  "error_spltools_notfound":                       "The SpartanLync Tools Add-In was not found. Please install and run to enable SpartanLync Temptrac / TPMS features",
  "error_vehicle_cannot_fly":                      "Sorry, Cannot fly to this vehicle...please try again in a few minutes",
  "error_vehicle_no_gps":                          "Sorry, no current day GPS data for this vehicle",
  "error_vehicle_no_gps_click_show_btn_to_view":   "Sorry, no current day GPS data for this vehicle. Click Hide/Show button to view Vehicle on Map",
  "error_server_unavailable":                      "Server is unavailable, please try again later.",
  "error_not_enough_privs_to_switch":              "SplMap Error: Your MyGeotab Account does not have sufficient permissions to allow switching to SpartanLync Tools...Please run SpartanLync Tools manually.",
  "error_invalid_addin_array":                     "AddIn / customerPages Array Invalid",
  "error_invalid_user":                            "Missing or Invalid User Object",
  "error_systemsettings_missing_invalid":          "Missing or Invalid SystemSettings Object",

  "datepicker_enter_to_apply_change":              "In Popup, please hit ENTER to apply your time change",
  "datepicker_date_in_future":                     "Selected date is in future!",
  "map_fetching_historical_data_inprogress":       "Fetching Historical Data",
  "map_fetching_historical_data_completed":        "Historical Data Load Complete",

  "splgeotabmap_title":                            "Administer SpartanLync for MyGeotab Map Installation",
  "splgeotabmap_init_msg":                         "Checking Installation Status",
  "splgeotabmap_success_msg":                      "Successfully {op} SpartanLync {intofrom} MyGeotab Map",
  "splgeotabmap_install_btnlbl":                   "Install for Everyone",
  "splgeotabmap_uninstall_btnlbl":                 "Remove for Everyone",
  "splgeotabmap_my_account_disable":               "Remove My Account Only",
  "splgeotabmap_my_account_enable":                "Enable for My Account",
  "splgeotabmap_no_install_btnlbl":                "Cannot {op} for Everyone",
  "splgeotabmap_no_install_btnsublbl":             "Not enough priviliges...Please have your database Owner/Admin use this buttom",
  "splgeotabmap_addin_installed_msg":              "SpartanLync detected as Installed into MyGeotab Map",
  "splgeotabmap_addIn_notinstalled_msg":           "SpartanLync is NOT Installed in MyGeotab Map",
  "splgeotabmap_failure_msg":                      "Failed to {op} SpartanLync {tofrom} MyGeotab Map",
  "splgeotabmap_init_failure_msg":                 "Failed to Initialize SpartanLync in MyGeotab Map",
  "splgeotabmap_err_fetch_userdata_msg":           "Missing user account data after Fetching from Geotab API",
  "splgeotabmap_err_fetch_systemdata_msg":         "Missing System Settings data after Fetching from Geotab API",
  "splgeotabmap_feature_preview_enabled_foruser":  "SpartanLync in MyGeotab Map already Enabled for [ {username} ]",
  "splgeotabmap_feature_preview_op_success_msg":   "{op} SpartanLync in MyGeotab Map for [ {username} ]",
  "splgeotabmap_feature_preview_op_failure_msg":   "Failed to {op} SpartanLync in MyGeotab Map for user [ {username} ]",
  "splgeotabmap_consent_install_msg":              "Get SpartanLync sensor information in MyGeotab Map for all users within this database by choosing the following Install option.",
  "splgeotabmap_consent_uninstall_msg":            "You can remove SpartanLync from MyGeotab Map at any time from the SpartanLync Icon menu.",
  "splgeotabmap_consent_btn_label_install":        "Install into MyGeotab Map",
  "splgeotabmap_consent_btn_label_skip":           "Not Now",

  "about_appname":                                 "SpartanLync Map",
  "about_instruction":                             "Use SpartanLync Tools to change the above settings",
  "about_timezone":                                "Date & Time Timezone",
  "about_refresh":                                 "Sensor Info Refresh Rate",
  "about_lang":                                    "Language",
  "about_buildver":                                "Build Version",
  "about_builddate":                               "Build Date",
  "about_unknown":                                 "UnKnown",

  // Fault Alerts
  "alert_tooltip":                                 "{alert_msg}<br />on<br />{timestamp}",
  "alert_header":                                  "Post-Ignition Alert",
  "alert_header_red":                              "RED Alert",
  "alert_header_amber":                            "AMBER Alert",
  "alert_sensor_location_header":                  "Sensor Location",
  "alert_missing_sensor":                          "Missing Sensor",
  "alert_temperature_over":                        "Over Temperature",
  "alert_temp_extreme_low":                        "Extreme Low Temperature",
  "alert_temp_extreme_high":                       "Extreme High Temperature",
  "leak_detected":                                 "Leak Detected",
  "alert_pressure_extreme_over":                   "Extreme Over Pressure",
  "alert_pressure_extreme_under":                  "Extreme Under Pressure",
  "alert_pressure_over":                           "Over Pressure",
  "alert_pressure_under":                          "Under Pressure",
  "alert_battery_low_voltage":                     "Vehicle Battery has LOW Voltage",
  "alert_tire_temperature_fault":                  "Tire Temperature Fault",
  "alert_tire_pressure_fault":                     "Tire Pressure Fault",
  "alert_temptrac_fault":                          "TempTrac Fault",
  "alert_desc_zone":                               "Zone",
  "alert_desc_axle":                               "Axle",
  "alert_desc_tire":                               "Tire",
  "alert_desc_tractor":                            "Tractor",
  "alert_desc_trailer":                            "Trailer",
  "alert_desc_dolly":                              "Dolly",
}
