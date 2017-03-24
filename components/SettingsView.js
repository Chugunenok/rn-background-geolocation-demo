'use strict';

import React, { Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  AsyncStorage,
  TouchableWithoutFeedback
 } from 'react-native';

import Icon from 'react-native-vector-icons/Ionicons';
import Modal from 'react-native-modalbox';
import Button from 'apsl-react-native-button'
import AboutView from './AboutView';
import {
  Form,
  Separator,
  InputField,
  SwitchField,
  PickerField
} from 'react-native-form-generator';

import SettingsService from './SettingsService';
import BGService from './BGService';

import commonStyles from './styles';
import Config from './config';

class SettingsView extends React.Component {
  constructor(props) {
    super(props);


    this.bgService = BGService.getInstance();
    this.settingsService = SettingsService.getInstance();

    // Default state
    this.state = {
      geofence: {
        radius: '200',
        notifyOnEntry: true,
        notifyOnExit: false,
        notifyOnDwell: false,
        loiteringDelay: 0
      },
      map: {},
      bgGeo: {}
    };
  }

  open() {
    this.refs.modal.open();
  }

  load() {
    let form = this.refs.form;

    // Fetch current state of BackgroundGeolocation
    this.bgService.getState((state) => {

      state.logLevel = this.decodeLogLevel(state.logLevel),
      state.trackingMode = (state.trackingMode === 1 || state.trackingMode === 'location') ? 'location' : 'geofence';

      this.setState({
        bgGeo: state
      });

      // Load form values
      this.bgService.getPlatformSettings().forEach((setting) => {
        let field = form.refs[setting.name];
        let value = state[setting.name]
        if (!field) {
          console.warn('Failed to find ref for field: ', setting.name);
        } else {
          switch (setting.inputType) {
            case 'select':
              value = value.toString();
              break;
          }
          field.setValue(value);
        }
      });
    });

    // Load app settings
    this.settingsService.getState((state) => {
      this.settingsService.getSettings().forEach((setting) => {
        let field = form.refs[setting.name];
        if (!field) {
          return;
        }
        let value = state[setting.name];
        switch (setting.inputType) {
          case 'select':
            value = value.toString();
            break;
        }
        field.setValue(value);
      });
    });
  }

  componentDidMount() {

  }

  onClickClose() {
    this.bgService.playSound('CLOSE');
    this.refs.modal.close();
  }

  onClickAbout() {
    this.refs.aboutModal.open();
  }

  onClickLoadGeofences() {
    if (this.state.isLoadingGeofences) { return false; }
    this.setState({isLoadingGeofences: true});

    this.settingsService.getState((state) => {
      this.bgService.loadTestGeofences('city_drive', state, () => {
        this.settingsService.toast('Loaded City Drive geofences');
        this.setState({isLoadingGeofences: false});
      });
    });
  }

  onClickClearGeofences() {
    this.bgService.removeGeofences();
  }

  onClickEmailLogs() {

  }

  setTrackingMode(trackingMode){
    this.bgService.playSound('BUTTON_CLICK');
    this.setState({
      trackingMode
    });
    let bgGeo = this.bgService.getPlugin();
    if (trackingMode == "location") {
      bgGeo.start();
    } else {
      bgGeo.startGeofences();
    }
    if (typeof(this.props.onChange) === 'function') {  // <-- Android
      this.props.onChange('trackingMode', trackingMode);
    }
  }

  decodeLogLevel(logLevel) {
    let value = 'VERBOSE';
    switch(logLevel) {
      case 0:
        value = 'OFF';
        break;
      case 1:
        value = 'ERROR';
        break;
      case 2:
        value = 'WARN';
        break;
      case 3:
        value = 'INFO';
        break;
      case 4:
        value = 'DEBUG';
        break;
      case 5:
        value = 'VERBOSE';
        break;
    }
    return value;
  }

  encodeLogLevel(logLevel) {
    let value = 0;
    let bgGeo = this.bgService.getPlugin();
    switch(logLevel) {
      case 'OFF':
        value = bgGeo.LOG_LEVEL_OFF;
        break;
      case 'ERROR':
        value = bgGeo.LOG_LEVEL_ERROR;
        break;
      case 'WARN':
        value = bgGeo.LOG_LEVEL_WARNING;
        break;
      case 'INFO':
        value = bgGeo.LOG_LEVEL_INFO;
        break;
      case 'DEBUG':
        value = bgGeo.LOG_LEVEL_DEBUG;
        break;
      case 'VERBOSE':
        value = bgGeo.LOG_LEVEL_VERBOSE;
        break;
    }
    return value;
  }

  setGeofenceProximityRadius(value) {
    this.bgService.playSound('BUTTON_CLICK');
    var state = {geofenceProximityRadius: value}
    this.setState(state);
    var decodedValue = parseInt(value.match(/[0-9]+/)[0], 10)*1000;

    /*
    SettingsService.set('geofenceProximityRadius', decodedValue, function(state) {
      if (typeof(me.props.onChange) === 'function') {  // <-- Android
        me.props.onChange('geofenceProximityRadius', decodedValue);
      }
    });
    */
    console.warn('TODO setGeofenceProximityRadius');
  }

  onFormChange() {

  }

  onFieldChange(setting, value) {

    let state = this.state.bgGeo;
    let currentValue = state[setting.name];

    switch (setting.dataType) {
      case 'integer':
        value = parseInt(value, 10);
        break;
    }

    if (state[setting.name] === value) {
      return;
    }

    // Buffer field-changes by 500ms
    function doChange() {
      state[setting.name] = value;
      this.setState({bgGeo: state});

      // Encode applicable settings for consumption by plugin.
      switch(setting.name) {
        case 'logLevel':
          value = this.encodeLogLevel(value);
          break;
      }
      let config = {};
      config[setting.name] = value;

      this.bgService.getPlugin().setConfig(config, (state) => {
        console.log('- setConfig success', state);
      });
    }

    if (this.changeBuffer) {
      this.changeBuffer = clearTimeout(this.changeBuffer);
    }
    this.changeBuffer = setTimeout(doChange.bind(this), 500);
  }

  buildField(setting, onValueChange) {
    let field = null;
    switch(setting.inputType) {
      case 'text':
        field = (
          <InputField 
            key={setting.name}
            ref={setting.name}
            onValueChange={(value) => {onValueChange(setting, value)}}
            placeholder={setting.defaultValue} />
        );
        break;
      case 'select':
        let options = {};
        setting.values.forEach((value) => {
          options[value.toString()] = value.toString();
        });

        field = (
          <PickerField
            key={setting.name}
            ref={setting.name}
            labelStyle={{paddingLeft: 10, fontSize: 16, color: '#687DCA', flex: 1, alignSelf: 'center', backgroundColor: '#fff'}}
            containerStyle={{borderBottomColor: '#C8C7CC', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: '#fff'}}
            pickerStyle={{flex: 0.4, backgroundColor: Config.colors.light_gold}}
            onValueChange={(value) => {onValueChange(setting, value)}}
            label={setting.name}
            options={options} />
        );
        break;
      case 'toggle':
        field = (
          <SwitchField 
            ref={setting.name}
            key={setting.name}
            label={setting.name}
            labelStyle={{alignSelf: 'center', fontSize: 16, paddingLeft: 10, color: '#687DCA'}}
            onValueChange={(value) => {onValueChange(setting, value)}} />
        );
        break;
      default:
        field = (<Text key={setting.name}>Unknown field-type for {setting.name} {setting.inputType}</Text>);
        break;
    }
    return field;
  }

  getPlatformSettings(section) {
    return this.bgService.getPlatformSettings(section).map((setting) => {
      return this.buildField(setting, this.onFieldChange.bind(this));
    });
  }

  getGeofenceTestSettings() {
    return this.settingsService.getSettings('geofence').map((setting) => {
      return this.buildField(setting, this.settingsService.onChange.bind(this.settingsService));
    });
  }

  getAboutModal() {
    return this.refs.aboutModal;
  }
  render() {
    return (
      <Modal ref="modal" swipeToClose={false} animationDuration={300} onOpened={this.load.bind(this)}>
        <View style={commonStyles.container}>
          <View style={commonStyles.topToolbar}>
            <Icon.Button
              name="ios-arrow-dropdown-circle"
              size={25}
              onPress={this.onClickClose.bind(this)}
              backgroundColor="transparent"
              underlayColor="transparent"
              color={Config.colors.black}>
            </Icon.Button>
            <Text style={commonStyles.toolbarTitle}>Settings</Text>
            <Button onPress={this.onClickAbout.bind(this)} style={styles.aboutButton}>About</Button>
          </View>
          <ScrollView keyboardShouldPersistTaps="always" style={{backgroundColor: '#eee'}}>
            <Form
              ref="form"
              onChange={this.onFormChange.bind(this)}>
              <Separator label="Geolocation" />
              {this.getPlatformSettings('geolocation')}
              <Separator label="Activity Recognition" />
              {this.getPlatformSettings('activity recognition')}
              <Separator label="HTTP & Persistence" />
              {this.getPlatformSettings('http')}
              <Separator label="Application" />
              {this.getPlatformSettings('application')}
              <Separator label="Logging & Debug" />
              <InputField key="email" ref="email" placeholder="Email" onValueChange={(value) => {this.settingsService.onChange('email', value)}} />
              {this.getPlatformSettings('debug')}
              <Separator label="Geofence Test (City Drive)" />
              <View style={[styles.setting, {flexDirection:"row"}]}>
                <View style={styles.label}>
                  <Button onPress={this.onClickClearGeofences.bind(this)} activeOpacity={0.7} style={[styles.button, styles.redButton]} textStyle={styles.buttonLabel}>
                    Clear
                  </Button>
                </View>
                <Text>&nbsp;&nbsp;&nbsp;</Text>
                <View style={styles.label}>
                  <Button onPress={this.onClickLoadGeofences.bind(this)} isLoading={this.state.isLoadingGeofences} activeOpacity={0.7} style={[styles.button, styles.blueButton]} textStyle={styles.buttonLabel}>
                    Load
                  </Button>
                </View>
              </View>
              {this.getGeofenceTestSettings()}
            </Form>
          </ScrollView>
        </View>
        <Modal swipeToClose={false} animationDuration={300} ref="aboutModal"><AboutView modal={() => {return this.refs.aboutModal}}/></Modal>
      </Modal>
    );
  }
};

var styles = StyleSheet.create({
  section: {
    marginBottom: 10
  },
  sectionHeading: {
    fontSize:16,
    fontWeight:"bold",
    margin: 10
  },
  setting: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth:1,
    borderBottomColor:"#ccc",
    padding: 10
  },
  columns: {
    flexDirection: 'row'
  },
  bigButton: {
    flex: 1
  },
  label: {
    flex: 1
  },
  panel: {
    backgroundColor: "#fff",
    borderTopWidth:1,
    borderTopColor: "#ccc",
  },
  button: {
    borderWidth:0,
    borderRadius: 5,
    marginBottom: 0
  },
  aboutButton: {
    borderRadius: 5,
    width: 70,
    height: 34

  },
  buttonLabel: {
    fontSize: 14, 
    color: '#fff'
  },
  redButton: {
    backgroundColor: '#ff3824'
  },
  blueButton: {
    backgroundColor: '#0076ff'
  }
});


module.exports = SettingsView;