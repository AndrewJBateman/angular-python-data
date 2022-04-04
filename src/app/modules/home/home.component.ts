import { Component, OnInit } from '@angular/core';
import {
  AngularFirestore
} from "@angular/fire/compat/firestore";
import { debounceTime } from 'rxjs/operators';

import { Chart, registerables } from 'chart.js';
import firebase from 'firebase/compat/app';
Chart.register(...registerables);

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  public canvasCO2: any; // HTML canvas
  public ctxCO2: any; // context for HTML canvas
  public chartCO2: any; // chart object for Chart.js

  public CO2SensorReading: any; // form input of new sensor value
  public condensateSensorReading: any;

  public historicalCO2: any[]; // stored data from Firebase (or hardcoded for testing)

  public currentSensorReadings: any; // current sensor readings for a given collection

  constructor(private firestore: AngularFirestore) {
    this.historicalCO2 = [];
  }

  ngOnInit(): void {
    this.initCO2Chart();

    let docNameCurrent = 'current'; // only storing the current sensor readings
    let docNameHistoric = this.buildHistoricDocName(); // storing an array of all sensor readings for the time bucket

    this.currentSensorReadings = this.firestore
      .collection('LNG_Process')
      .doc(docNameCurrent)
      .valueChanges(); // attach to the observable so HTML updated

    this.firestore
      .collection('LNG_Process')
      .doc(docNameCurrent)
      .valueChanges()
      .pipe(debounceTime(200))
      .subscribe((data: any) => {
        if (data && data.hasOwnProperty('level_CO2'))
          this.addDataToChart(this.chartCO2, '', data['level_CO2']); // when the 'current' doc changes, place the new CO2 value in the chart
      });

    this.firestore
      .collection('LNG_Process')
      .doc(docNameHistoric)
      .ref.get()
      .then((doc) => {
        // get the current hour's historical readings just once (without an observable)
        if (doc.exists) {
          let data: any = doc.data();
          let measurements = data['historicalMeasurements'];

          console.log('measurements', measurements);

          for (let i = 0; i < measurements.length; i++) {
            let measurement = measurements[i];
            let CO2 = measurement['level_CO2'];
            this.addDataToChart(this.chartCO2, '', CO2);
          }
        }
      })
      .catch((error) => {
        console.log('Error getting historical doc:', error);
      });

    this.randomizeSensorReadings(); // set our form inputs to random values
  }

  initCO2Chart() {
    this.canvasCO2 = document.getElementById('chartCO2');
    this.ctxCO2 = this.canvasCO2.getContext('2d');
    this.chartCO2 = new Chart(this.ctxCO2, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'CO2',
            data: [],
            fill: false,
            borderColor: 'rgb(44, 11, 179)',
            borderWidth: 1,
            pointStyle: 'rectRot',
            pointRadius: 2,
            pointBorderColor: 'rgb(0, 0, 0)',
            tension: 0.1,
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Chart of LNG Process Variables',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  }

  randomizeSensorReadings() {
    this.CO2SensorReading = this.generateRandomInt(0, 100);
    this.condensateSensorReading = this.generateRandomInt(60, 80);
  }

  generateRandomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  insertData() {
    let docNameCurrent = 'current'; // only storing the current sensor readings
    let docNameHistoric = this.buildHistoricDocName(); // storing an array of all sensor readings for the time bucket

    this.firestore.collection('LNG_Process').doc(docNameCurrent).set({
      CO2: this.CO2SensorReading,
      temperature: this.condensateSensorReading,
      // timestamp: firebase.firestore.Timestamp.now(),
      timestamp: firebase.firestore.Timestamp.now(),
    });

    this.firestore
      .collection('LNG_Process')
      .doc(docNameHistoric)
      .set(
        {
          historicalMeasurements: firebase.firestore.FieldValue
          .arrayUnion({
            CO2: this.CO2SensorReading,
            condensate: this.condensateSensorReading,
            timestamp: firebase.firestore.Timestamp.now(),
          }),
        },
        { merge: true }
      ); // provides an update and creates the doc if it doesn't exist

    this.randomizeSensorReadings(); // generate new random values for next time
  }

  buildHistoricDocName() {
    let now = new Date();

    let year = now.getFullYear();
    let month = now.getMonth() + 1 + ''; // javascript months are zero-based, so add 1
    let day = now.getDate() + '';
    let hour = now.getHours() + '';

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    if (hour.length < 2) hour = '0' + hour;
    hour = 'h' + hour;

    return [year, month, day, hour].join('_'); // ex: '2021_05_13_h09'
  }

  addDataToChart(chart: any, label: string, data: number) {
    chart.data.labels.push(label);
    chart.data.datasets.forEach((dataset: any) => {
      dataset.data.push(data);
    });
    chart.update();
  }
}
