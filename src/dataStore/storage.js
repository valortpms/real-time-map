const storage = {

   isStandAlone: false,

   startDate: undefined,
   delay: 300,

   exceptionsEnabled: true,

   maxZoom: 18,
   minZoom: 3,

   selectedStatuses: {},
   selectedExceptions: {},
   selectedDevices: {},

   realTimeFeedDataGetter: undefined,
   realTimeDataForVehsFetched: {},

   historicalComplete: false,
   historicalVehsFetched: {},
   historicalDataArchive: null,

   timezone: "",
   humanDateTimeFormat: "dd MMM DD, YYYY LT z",

   /**
    *  Getters/Setters for _dayStart
    */

   _dayStart: undefined,
   get dayStart() {
      return this._dayStart;
   },
   set dayStart(dayStart) {
      this._dayStart = dayStart;
   },

   /**
    *  Getters/Setters for _dayStart
    */

   _dayEnd: undefined,
   get dayEnd() {
      return this._dayEnd;
   },
   set dayEnd(dayEnd) {
      this._dayEnd = dayEnd;
   },

   /**
    *  Getters/Setters for _timeRangeStart
    */

   _timeRangeStart: undefined,
   get timeRangeStart() {
      return this._timeRangeStart;
   },
   set timeRangeStart(timeRangeStart) {
      this._timeRangeStart = timeRangeStart;
   },

   /**
    *  Getters/Setters for _currentTime
    */

   _currentTime: undefined,
   get currentTime() {
      return this._currentTime;
   },
   set currentTime(currentTime) {
      this._currentTime = currentTime;
   },

   /**
    *  Getters/Setters for _map
    */

   _map: undefined,
   get map() {
      return this._map;
   },
   set map(map) {
      this._map = map;
   },

   /**
    *  Getters/Setters for _dateKeeper$
    */

   _dateKeeper$: undefined,
   get dateKeeper$() {
      return this._dateKeeper;
   },
   set dateKeeper$(dateKeeper) {
      this._dateKeeper = dateKeeper;
   },
};

export default storage;