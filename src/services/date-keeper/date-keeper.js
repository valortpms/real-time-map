import storage from "../../dataStore";
import moment from "moment-timezone";
import splSrv from "../../spartanlync/services";

import {
   Subject,
   interval,
   empty
} from "rxjs";

import {
   switchMap,
   scan,
   startWith,
   mapTo,
   publish,
   throttleTime
} from "rxjs/operators";

import {
   checkIfLive,
   getLiveTime,
   resetTransitionAnimation
} from "../../utils/helper";

import {
   setupTimeObjects,
   updatePeriodChangeFunctions,
   updateTimeChangeFunctions,
   differentDateSet
} from "./date-keeper-helpers";

export function initDateKeeper() {

   // Re-initialize day boundaries, relative to UTC and User Timezone
   // Use UTC Timezone offset to
   // 1. allow slider to be timezone sensititve.
   // 2. Make timezone-aware From/To Date API calls in UTC format using user timezone boundaries
   splSrv.events.register("onSetTimeZoneDefault", () => {
      storage.timezone = splSrv._timeZone;
      setupTimeObjects(moment());
   });

   const startTimeUTC = moment.unix(moment().unix() - storage.delay);
   setupTimeObjects(startTimeUTC);

   storage.dateKeeper$ = dateKeeper;
   storage.dateKeeper$.init(storage.currentTime, 1000);

   storage.dateKeeper$.subscribe(currentSecond => storage.currentTime = currentSecond);

   storage.dateKeeper$.pause();
}

export const dateKeeper = {

   init(startDate, period = 1000) {

      this.startDate = startDate;
      this.newTime = startDate;
      this.period = period;
      this.paused = false;

      this.emitterSubject = new Subject();
      this.inputThrottler = new Subject();

      this.currentSecond$ = this.createDateKeeper();
      this.createInputThrottler();

      this.subscriberList = [];
   },

   get state() {
      return {
         period: this.period,
         newTimeSet: this.newTime,
         pause: this.paused
      };
   },

   get observable() {
      return this.currentSecond$;
   },

   getPeriod() {
      return this.period;
   },

   setPeriod(period) {
      this.period = period;
      this.paused = false;
      updatePeriodChangeFunctions(period);
      this.emitNext();
   },

   createDateKeeper() {
      const res = this.emitterSubject.pipe(

         startWith(this.state),

         switchMap(next => {

            if (next.pause) {
               return empty();
            }

            const res = interval(next.period).pipe(mapTo(false));
            if (next.newTimeSet) {
               this.newTime = false;
               return res.pipe(startWith(next.newTimeSet));
            }
            return res;

         }),

         scan((currentTime, newTimeSet) =>
            newTimeSet ? newTimeSet : currentTime + 1,
            0
         ),

         publish()
      );

      res.connect();
      this.newTime = false;
      return res;
   },

   createInputThrottler() {

      this.inputThrottler.pipe(
         throttleTime(360)
      ).subscribe(state => {
         this.emitterSubject.next(state);
      });

   },

   emitNext() {
      this.inputThrottler.next(this.state);
   },

   subscribe(callback) {
      const newSub = this.currentSecond$.subscribe(callback);
      this.subscriberList.push(newSub);
      return newSub;
   },

   pause() {
      this.paused = true;
      this.emitNext();
   },

   resume() {
      this.paused = false;
      this.emitNext();
   },

   setNewTime(newTimeInput) {
      this.newTime = Math.round(newTimeInput);
      if (this.newTime < storage.dayStart || this.newTime > storage.dayEnd) {
         this.pause();
         differentDateSet(this.newTime);
      }

      if (checkIfLive(this.newTime) > 600) {
         this.newTime = getLiveTime();
      }

      // Throw Event notifying of Date/Time change
      splSrv.events.exec("onPreDateTimeChange");

      storage.currentTime = this.newTime;
      updateTimeChangeFunctions(this.newTime);
      resetTransitionAnimation();

      // After date changes applied, Resume if clock paused
      setTimeout(function () {
         storage.dateKeeper$.resume();
      }, 500);
   },

   update() {
      storage.currentTime += 1;

      if (checkIfLive(storage.currentTime) > 600) {
         storage.currentTime = getLiveTime();
      }
      this.setNewTime(storage.currentTime);

      // SpartanLync tasks invoked on ControlBar UI Date Update
      splSrv.events.exec("onDateUpdate");
   }
};