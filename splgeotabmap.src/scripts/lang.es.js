/* eslint-disable */
if (typeof window.splgeotabmap == "undefined") {
  window.splgeotabmap = {
    lang: {}
  };
}
window.splgeotabmap.lang.es = {

  "reset_btn_desc":                     "Visualizaci&oacute;n al ras de TODOS los datos del sensor SpartanLync y recarga",
  "reset_btn_title":                    "Reiniciar",
  "reset_btn_msg":                      "LOS DATOS DEL SENSOR SE HAN RESTABLECIDO",
  "reset_failed_busy":                  "No se puede restablecer mientras se est&aacute; realizando una b&uacute;squeda de datos del sensor. Vuelva a intentarlo m&aacute;s tarde.",

  "veh_comp_tractor":                   "Tracto camión",
  "veh_comp_trailer1":                  "Remolque 1",
  "veh_comp_dolly":                     "Dolly",
  "veh_comp_trailer2":                  "Remolque 2",

  "sensors_not_found":                  "No se encontraron sensores",
  "sensors_tooltip_searching_msg":      "Buscando sensores SpartanLync ...",
  "sensors_tooltip_found_msg":          "Se detectaron sensores SpartanLync",
  "sensors_tooltip_found_menuitem_msg": "( Haga clic en 'Mostrar sensores SpartanLync' para obtener m&aacute;s detalles en EL PANEL DEL LADO DERECHO ===> )",
  "sensors_tooltip_not_found_msg":      "Sensores SpartanLync no encontrados",
  "sensors_tooltip_comp_found_msg":     "Capteurs supplémentaires détectés sur",
  "sensors_menuitm_searching_msg":      "Buscando [ <b>{veh}</b> ]<br /> para sensores Temptrac / TPMS ...<br />Espere hasta que vea los resultados de la b&uacute;squeda del sensor SpartanLync en la informaci&oacute;n sobre herramientas del mapa del veh&iacute;culo",
  "sensors_menuitm_not_Found_msg":      "No se encontraron sensores Temptrac / TPMS en el veh&iacute;culo [ <b>{veh}</b> ]",

  "map_menuitm_label":                  "Mostrar sensores SpartanLync",
  "map_menuitm_watchlist_add":          "Agregar a la lista de observación de SpartanLync",
  "map_menuitm_watchlist_remove":       "Eliminar de la lista de seguimiento de SpartanLync",
  "panel_btn_close_title":              "Cerrar",
  "panel_title":                        "Sensores SpartanLync para:",
  "panel_sensor_timestamp":             "Marca de tiempo del sensor",
  "panel_last_reading":                 "&Uacute;ltima lectura",
  "panel_switchto_spltools_instruction":"Ver en herramientas SpartanLync",
  "panel_user_instruction":             "Coloca el cursor sobre un vehículo o haz clic en él para ver la información más reciente del sensor SpartanLync",
  "panel_search_busy_msg":              "OCUPADO",
  "panel_veh_jump_widget_title":        "Saltar al vehículo",

  "error_title":                        "Error",
  "error_app_title":                    "Error de SplGeotabMap",
  "error_startup_general":              "FALLÓ getSplSettings():",
  "error_failed_saving_watchlist":      "FALLÓ saveWatchlist():",
  "error_startup_nosettings":           "Herramientas / Configuraci&oacute;n del mapa de SpartanLync no v&aacute;lidas o faltantes",
  "error_startup_nosplmap":             "Falta la configuraci&oacute;n del mapa SpartanLync.<br />Primero ejecute Spartanlync Map",
  "error_startup_nospltools":           "Falta la configuraci&oacute;n de SpartanLync Tools.<br />Primero ejecute Spartanlync Tools",
  "error_spltools_switch_failed":       "Error al cambiar a SpartanLync Tools:",
  "error_spltools_switch_noprivsfound": "Error de SplMap: su cuenta MyGeotab no tiene permisos suficientes para permitir el cambio a SpartanLync Tools ... Ejecute SpartanLync Tools manualmente.",
  "error_spltools_switch_getnoprivs":   "No se pudieron obtener los permisos de MyGeotab para cambiar a las herramientas SpartanLync:",

  "about_appname":                      "SpartanLync MyGeotab Map",
  "about_instruction":                  "Use SpartanLync Tools para cambiar la configuraci&oacute;n anterior",
  "about_timezone":                     "Fecha y hora (Zona horaria)",
  "about_refresh":                      "Frecuencia de actualizaci&oacute;n de la informaci&oacute;n del sensor",
  "about_lang":                         "Idioma",
  "about_buildver":                     "Versi&oacute;n de compilaci&oacute;n",
  "about_builddate":                    "Fecha de creación",
  "about_unknown":                      "desconocido",

  // Fault Alerts
  "alert_tooltip":                      "{alert_msg}<br />en<br />{timestamp}",
  "alert_header":                       "Alerta post-ignición",
  "alert_sensor_location_header":       "Ubicación del sensor",
  "alert_missing_sensor":               "Sensor faltante",
  "alert_temperature_over":             "Exceso de temperatura",
  "alert_pressure_extreme_over":        "Sobrepresión extrema",
  "alert_pressure_extreme_under":       "Presión extrema",
  "alert_pressure_over":                "Sobrepresión",
  "alert_pressure_under":               "Bajo presión",
  "alert_battery_low_voltage":          "La batería del vehículo tiene BAJO voltaje",
  "alert_tire_temperature_fault":       "Fallo de temperatura de los neumáticos",
  "alert_tire_pressure_fault":          "Fallo de presión de los neumáticos",
  "alert_desc_zone":                    "Zona",
  "alert_desc_axle":                    "Eje",
  "alert_desc_tire":                    "Neum&aacute;tico",
  "alert_desc_tractor":                 "Tractor",
  "alert_desc_trailer":                 "Remolque",
  "alert_desc_dolly":                   "Muñequita",
  "alert_tooltip_instruction_msg":      "( Haga clic para obtener más detalles sobre EL PANEL DEL LADO DERECHO ===> )",
}
