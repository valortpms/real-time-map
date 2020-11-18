geotab.addin.splgeotabmap = (elt, service) => {
  //
  // App Settings
  //
  const addInJSONName = "SplGeotabMap";                               // Name of this Add-In within SystemSettings in MyGeotab Database
  const addInBuildMetadataFilename = "build.meta";                    // Filename residing in deployment directory containg build metadata, shown when hovering over SpartanLync Watermark / Logo

  const splApiUrl = "https://help.spartansense.com/geotab/api/";      // API Endpoint for SpartanLync Backend Services
  const splHumanTimeFormat = "dd MMM DD, YYYY LT z";                  // moment() format for converting from UNIX timestamp to Human format in User's Timezone

  const cachedStoreLifetime = 3600;                                   // (Default: 3600 seconds / 1 hour) Afer this period, cached credentials & SplTools settings in Local Store is refreshed from API (in seconds)
  const sensorSearchRetryRangeInDays = [1, 2, 7, 30, 60, 90];         // Days from now to search for sensors (on App Start)
  const sensorSearchTimeRangeForRepeatSearchesInSeconds = 3600;       // (Default: 1 Hour) 3600 Seconds from now to use for repeating sensor search's

  const faultSearchRetryRangeInDays = [30, 60, 90];                   // Days from now to search for faults (on App Start)
  const faultSearchTimeRangeForRepeatSearchesInSeconds = 3600;        // 3600 Seconds from now to use for repeating fault search's (default: 1 Hour)

  const uiUpdatePollingTime = 20;                                     // How frequently does update service refresh ToolTip / MenuItem UI (In seconds)

  const addInLocalStorageKeyName = "splGeotabMapStore";               // Lookup key to use when saving/retrieving/removing data from Browser Local Storage
  const addInLocalStorageSecret = "DKrKcInKvtb9wRB0le1qI7arr12yVTHU"; // Secret Passphrase used to encrypt/decryt storage data saved to Browser

  const defaultLanguage = "en";
  const supportedLanguages = {                                        // Languages supported by SplGeotabMap
    "en": "English",
    "fr": "Fran&#231;ais",
    "es": "Espa&#241;ol"
  };

  const vehComponents = {                                             // Id/Description/TranslationCodes for supported Vehicles components
    "toEn": {
      "tractor": "Tractor",
      "trailer1": "Trailer 1",
      "trailer2": "Dolly",
      "trailer3": "Trailer 2"
    },
    "toTr": {
      "tractor": "veh_comp_tractor",
      "trailer1": "veh_comp_trailer1",
      "trailer2": "veh_comp_dolly",
      "trailer3": "veh_comp_trailer2"
    }
  };

  const splSelContainer = "#SplGeotabMapContainer";                   // Dom selector for splGeotabMap AddIn HTML container
  const splSelResetBtn = "#SplGeotabMapResetBtn button";              // Dom selector for splGeotabMap Reset button
  const splSelGeotabMapLogo = "#SplGeotabMapLogo";                    // Dom selector for splGeotabMap Logo
  const splSelLabel = "#SplGeotabMapContainer .title label";          // Dom selector for Panel Label in output HTML
  const splSelTitleBold = "#SplGeotabMapContainer .title strong";     // Dom selector for Vehicle Name in output HTML
  const splSelPnlJmprContainer = "#SplGeotabMapVehPicker";            // Dom selector for Panel Vehicle Jumper Container in output HTML
  const splSelPnlJmprMenu = "#SplGeotabMapVehPicker > div";           // Dom selector for Panel Vehicle Jumper Menu Wrapper in output HTML

  // iFrame Parent Dom selector for MyGeotab Map page Add-In Panel Open/Close button
  const geotabAddInPanelOpenCloseBtnSel = "#liveMap_detailsPanelAndMapCanvasLayout .mapAddinResizer .resizerButton";
  const geotabAddInPanelSel = "#liveMap_addinsPanel";                 // iFrame Parent Dom selector for MyGeotab Map page Add-In Panel
  const geotabAddInPanelClass = "hiddenPane";                         // CSS class on the
  const vehPanelContentIdPrefix = "vehSensorDataPanelId";             // Prefix to Dom ID for Vehicle-specific Sensor Data view in Panel UI


  // Private Vars
  const my = {
    // APIs
    splApi: null,
    splSessionMgr: null,
    service: service,
    localStore: null,
    goLib: null,

    // Data Objects
    storage: {
      sensorData: {
        searchInProgress: "",
        cache: {},
        faultCache: {},
        ignitionCache: {},
        watchlistData: {
          index: []
        },
        vehRegistry: {
          tooltip: "",
          watchlist: [],
        },
      },
      credentials: {
        db: "",
        username: "",
        server: "",
        sessionId: "",
      },
      splStoreFetchedUnix: null,
      splStore: null,
    },

    toolTipSettings: {
      cfg: {
        icon:
          "data:image/png;base64,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",
        main: "",
        secondary: [],
        additional: [],
      }
    },

    mapAlertMarkers: {},
    watchlistAndAlertSettings: {
      mapVehMenuItemIcon: "data:image/svg+xml;base64,PHN2ZyBpZD0ic3BhcnRhbmx5bmMtd2F0Y2hsaXN0LWljb24iIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgdmlld0JveD0iMCAwIDMyIDMyIj48cGF0aCBpZD0id2hpdGUiIGQ9Ik02Ljg2LDMyYTIuMzgsMi4zOCwwLDAsMS0yLjM5LTIuMzZWOC43NkEyLjM4LDIuMzgsMCwwLDEsNi44Niw2LjRoMS4zYTMuMTEsMy4xMSwwLDAsMSwzLjA3LTIuN2guMTNhNC43Niw0Ljc2LDAsMCwxLDkuMjgsMGguMTJhMy4xMiwzLjEyLDAsMCwxLDMuMDgsMi43aDEuM2EyLjM4LDIuMzgsMCwwLDEsMi4zOSwyLjM2VjI5LjY0QTIuMzgsMi4zOCwwLDAsMSwyNS4xNCwzMloiIGZpbGw9IiNmZmYiLz48cGF0aCBpZD0iZGFyay1ncmF5IiBkPSJNMjUuMTQsNy40SDIyLjg3VjYuODFBMi4xMiwyLjEyLDAsMCwwLDIwLjc2LDQuN2gtMWEzLjc2LDMuNzYsMCwwLDAtNy41MiwwaC0xYTIuMTEsMi4xMSwwLDAsMC0yLjEsMi4xMVY3LjRINi44NkExLjM5LDEuMzksMCwwLDAsNS40Nyw4Ljc2VjI5LjY0QTEuMzksMS4zOSwwLDAsMCw2Ljg2LDMxSDI1LjE0YTEuMzksMS4zOSwwLDAsMCwxLjM5LTEuMzZWOC43NkExLjM5LDEuMzksMCwwLDAsMjUuMTQsNy40Wk0xNiwzQTEuNzksMS43OSwwLDAsMSwxNy43OSw0LjdIMTQuMjFBMS43OSwxLjc5LDAsMCwxLDE2LDNabTguNTMsMjZINy40N1Y5LjRIOS4xM3YuODZIMjIuODdWOS40aDEuNjZabS02LTExLjkyYTUuOTIsNS45MiwwLDEsMS04LjM3LDguMzcsMS4zLDEuMywwLDAsMSwwLTEuODQsMS4zMiwxLjMyLDAsMCwxLDEuODQsMCwzLjMyLDMuMzIsMCwxLDAsNC42OS00LjY5LDEuMzIsMS4zMiwwLDAsMSwwLTEuODRBMS4zLDEuMywwLDAsMSwxOC41NSwxNy4wOFoiIGZpbGw9IiMyZjNjNDMiLz48cGF0aCBpZD0ibGlnaHQtZ3JheSIgZD0iTTEzLjQ1LDIyLjE4YTUuOTIsNS45MiwwLDAsMSw4LjM3LTguMzdBMS4zLDEuMywwLDAsMSwyMCwxNS42NWEzLjMyLDMuMzIsMCwxLDAtNC42OSw0LjcsMS4zLDEuMywwLDAsMS0xLjg0LDEuODNaIiBmaWxsPSIjOTc5ZGExIi8+PC9zdmc+",

      mapVehAlertIconAmber: "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJzcGFydGFubHluYy1pY29uIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiCgkgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTI4IDEyODsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiMyRjNDNDM7fQoJLnN0MXtmaWxsOiM5NzlEQTE7fQo8L3N0eWxlPgo8cGF0aCBpZD0iZGFyay1ncmF5IiBjbGFzcz0ic3QwIiBkPSJNMTA4LjMsNDkuN2MwLDI2LjMtNDcuNyw3Ni4zLTQ3LjcsNzYuM1MxMyw3NiwxMyw0OS43QzEzLDIzLjMsMzQuMywyLDYwLjcsMgoJUzEwOC4zLDIzLjMsMTA4LjMsNDkuN0wxMDguMyw0OS43eiBNOTQuMiw0OS43YzAtMTguNi0xNS0zMy42LTMzLjYtMzMuNmMtMTguNiwwLTMzLjYsMTUtMzMuNiwzMy42YzAsMTguNiwxNSwzMy42LDMzLjYsMzMuNgoJQzc5LjIsODMuMiw5NC4yLDY4LjIsOTQuMiw0OS43TDk0LjIsNDkuN3ogTTYyLDQwLjJjLTIuMiwyLjMtMi4yLDUuOSwwLDguMWMzLjcsMy43LDMuNyw5LjgsMCwxMy42cy05LjgsMy43LTEzLjYsMAoJYy0wLjgtMC43LTItMC42LTIuNywwLjJjLTAuNiwwLjctMC42LDEuOCwwLDIuNWM1LjIsNS4yLDEzLjgsNS4yLDE5LDBzNS4yLTEzLjgsMC0xOWMtMC44LTAuOC0wLjgtMiwwLTIuN3MyLTAuOCwyLjcsMAoJYzYuNyw2LjcsNi43LDE3LjcsMCwyNC40Yy02LjcsNi43LTE3LjcsNi43LTI0LjQsMGMtMC44LTAuNy0yLTAuNS0yLjcsMC4zYy0wLjYsMC43LTAuNiwxLjcsMCwyLjRjOC4zLDguMiwyMS42LDguMSwyOS44LTAuMgoJYzguMS04LjIsOC4xLTIxLjQsMC0yOS42QzY3LjksMzcuOSw2NC4yLDM3LjksNjIsNDAuMnoiPgoJIDxhbmltYXRlCiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVUeXBlPSJYTUwiCiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lPSJmaWxsIgogICAgICAgICAgICAgICAgdmFsdWVzPSIjRkJCRDA0OyNGQkJEMDQ7I0ZCQkQwNDsjMkYzQzQzOyMyRjNDNDMiCiAgICAgICAgICAgICAgICBkdXI9IjEuNXMiCiAgICAgICAgICAgICAgICByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPgoJPC9wYXRoPgo8cGF0aCBpZD0ibGlnaHQtZ3JheSIgY2xhc3M9InN0MSIgZD0iTTUxLjIsMjkuM2MtOC4yLDguMi04LjIsMjEuNiwwLDI5LjhjMCwwLDAsMCwwLDBjMi4zLDIuMiw1LjksMi4yLDguMSwwYzIuMi0yLjMsMi4yLTUuOSwwLTguMQoJQzU1LjcsNDcuMSw1Niw0MSw2MCwzNy41YzMuNy0zLjMsOS4yLTMuMywxMi45LDBjMC44LDAuNywyLDAuNiwyLjctMC4yYzAuNi0wLjcsMC42LTEuOCwwLTIuNWMtNS4yLTUuMi0xMy44LTUuMi0xOSwwCglzLTUuMiwxMy44LDAsMTljMC43LDAuOCwwLjYsMi0wLjIsMi43Yy0wLjcsMC42LTEuOCwwLjYtMi41LDBjLTYuNy02LjctNi43LTE3LjcsMC0yNC40czE3LjctNi43LDI0LjQsMGMwLjgsMC44LDIsMC44LDIuNywwCgljMC44LTAuOCwwLjgtMiwwLTIuN2wwLDBDNzIuOCwyMS4xLDU5LjQsMjEuMSw1MS4yLDI5LjNDNTEuMiwyOS4zLDUxLjIsMjkuMyw1MS4yLDI5LjN6Ii8+Cjwvc3ZnPgo=",
      mapVehAlertIconRed: "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB2ZXJzaW9uPSIxLjEiIGlkPSJzcGFydGFubHluYy1pY29uIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4PSIwcHgiCgkgeT0iMHB4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTI4IDEyODsiIHhtbDpzcGFjZT0icHJlc2VydmUiPgo8c3R5bGUgdHlwZT0idGV4dC9jc3MiPgoJLnN0MHtmaWxsOiMyRjNDNDM7fQoJLnN0MXtmaWxsOiM5NzlEQTE7fQo8L3N0eWxlPgo8cGF0aCBpZD0iZGFyay1ncmF5IiBjbGFzcz0ic3QwIiBkPSJNMTA4LjMsNDkuN2MwLDI2LjMtNDcuNyw3Ni4zLTQ3LjcsNzYuM1MxMyw3NiwxMyw0OS43QzEzLDIzLjMsMzQuMywyLDYwLjcsMgoJUzEwOC4zLDIzLjMsMTA4LjMsNDkuN0wxMDguMyw0OS43eiBNOTQuMiw0OS43YzAtMTguNi0xNS0zMy42LTMzLjYtMzMuNmMtMTguNiwwLTMzLjYsMTUtMzMuNiwzMy42YzAsMTguNiwxNSwzMy42LDMzLjYsMzMuNgoJQzc5LjIsODMuMiw5NC4yLDY4LjIsOTQuMiw0OS43TDk0LjIsNDkuN3ogTTYyLDQwLjJjLTIuMiwyLjMtMi4yLDUuOSwwLDguMWMzLjcsMy43LDMuNyw5LjgsMCwxMy42cy05LjgsMy43LTEzLjYsMAoJYy0wLjgtMC43LTItMC42LTIuNywwLjJjLTAuNiwwLjctMC42LDEuOCwwLDIuNWM1LjIsNS4yLDEzLjgsNS4yLDE5LDBzNS4yLTEzLjgsMC0xOWMtMC44LTAuOC0wLjgtMiwwLTIuN3MyLTAuOCwyLjcsMAoJYzYuNyw2LjcsNi43LDE3LjcsMCwyNC40Yy02LjcsNi43LTE3LjcsNi43LTI0LjQsMGMtMC44LTAuNy0yLTAuNS0yLjcsMC4zYy0wLjYsMC43LTAuNiwxLjcsMCwyLjRjOC4zLDguMiwyMS42LDguMSwyOS44LTAuMgoJYzguMS04LjIsOC4xLTIxLjQsMC0yOS42QzY3LjksMzcuOSw2NC4yLDM3LjksNjIsNDAuMnoiPgoJIDxhbmltYXRlCiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVUeXBlPSJYTUwiCiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVOYW1lPSJmaWxsIgogICAgICAgICAgICAgICAgdmFsdWVzPSIjQkQyNzI3OyNCRDI3Mjc7I0JEMjcyNzsjMkYzQzQzOyMyRjNDNDMiCiAgICAgICAgICAgICAgICBkdXI9IjEuNXMiCiAgICAgICAgICAgICAgICByZXBlYXRDb3VudD0iaW5kZWZpbml0ZSIvPgoJPC9wYXRoPgo8cGF0aCBpZD0ibGlnaHQtZ3JheSIgY2xhc3M9InN0MSIgZD0iTTUxLjIsMjkuM2MtOC4yLDguMi04LjIsMjEuNiwwLDI5LjhjMCwwLDAsMCwwLDBjMi4zLDIuMiw1LjksMi4yLDguMSwwYzIuMi0yLjMsMi4yLTUuOSwwLTguMQoJQzU1LjcsNDcuMSw1Niw0MSw2MCwzNy41YzMuNy0zLjMsOS4yLTMuMywxMi45LDBjMC44LDAuNywyLDAuNiwyLjctMC4yYzAuNi0wLjcsMC42LTEuOCwwLTIuNWMtNS4yLTUuMi0xMy44LTUuMi0xOSwwCglzLTUuMiwxMy44LDAsMTljMC43LDAuOCwwLjYsMi0wLjIsMi43Yy0wLjcsMC42LTEuOCwwLjYtMi41LDBjLTYuNy02LjctNi43LTE3LjcsMC0yNC40czE3LjctNi43LDI0LjQsMGMwLjgsMC44LDIsMC44LDIuNywwCgljMC44LTAuOCwwLjgtMiwwLTIuN2wwLDBDNzIuOCwyMS4xLDU5LjQsMjEuMSw1MS4yLDI5LjNDNTEuMiwyOS4zLDUxLjIsMjkuMyw1MS4yLDI5LjN6Ii8+Cjwvc3ZnPgo=",
      mapVehAlertIconWidth: 40,
      mapVehAlertIconHeight: 40,
      mapVehAlertIconXOffset: -20,
      mapVehAlertIconYOffset: -60,
      mapVehAlertIconZIndex: 30,

      defaultCfg: {
        type: [],
        time: 0,
        name: "",
        speed: 0,
        loc: {
          lat: 0,
          lng: 0
        }
      }
    },

    // App Objects / Methods
    elt: elt,
    ui: null,
    tr: null,
    app: null,
    logo: null,
    vehCompDb: {},
    sdataTools: null,
    resetBtnElemObj: elt.querySelector(splSelResetBtn),

    // App Settings
    timeFormat: splHumanTimeFormat,
    vehComponents: vehComponents,
    storeLifetime: cachedStoreLifetime,
    uiUpdatePollingTime: uiUpdatePollingTime,
    supportedLanguages: supportedLanguages,
    defaultLanguage: defaultLanguage,
    addInJSONName: addInJSONName,
    vehPanelContentIdPrefix: vehPanelContentIdPrefix,
    addInBuildMetadataFilename: addInBuildMetadataFilename,
    sensorSearchRetryRangeInDays: sensorSearchRetryRangeInDays,
    sensorSearchTimeRangeForRepeatSearchesInSeconds: sensorSearchTimeRangeForRepeatSearchesInSeconds,
    faultSearchRetryRangeInDays: faultSearchRetryRangeInDays,
    faultSearchTimeRangeForRepeatSearchesInSeconds: faultSearchTimeRangeForRepeatSearchesInSeconds
  };

  // Initialize App Objects
  my.goLib = INITGeotabTpmsTemptracLib(
    my.service.api,
    my.sensorSearchRetryRangeInDays,
    my.sensorSearchTimeRangeForRepeatSearchesInSeconds,
    my.faultSearchRetryRangeInDays,
    my.faultSearchTimeRangeForRepeatSearchesInSeconds
  );
  my.vehCompDb = my.goLib.getVehComponentDB();
  my.ui = new InitOutputUI(my, elt,
    splSelContainer, splSelLabel, splSelTitleBold,
    geotabAddInPanelOpenCloseBtnSel, geotabAddInPanelSel, geotabAddInPanelClass,
    splSelPnlJmprContainer, splSelPnlJmprMenu
  );
  my.localStore = new InitLocalStorage(my, addInLocalStorageKeyName, addInLocalStorageSecret);
  my.sdataTools = new INITSplSensorDataTools(my.goLib, my.storage.sensorData.cache);
  my.sdataTools.setVehComponents(my.vehComponents.toEn);
  my.logo = new InitLogoUI(my, elt, splSelGeotabMapLogo);
  my.splApi = new INITSplAPI(splApiUrl);
  my.app = SplGeotabMapUtils(my);
  my.tr = my.app.tr.t;
  onLoadInitEvents(my);
};
