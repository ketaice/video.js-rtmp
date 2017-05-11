/**
 * @file webfire.js
 * VideoJS-SWF - Custom Flash Player with HTML5-ish API
 * https://github.com/zencoder/video-js-swf
 * Not using setupTriggers. Using global onEvent func to distribute events
 */

import Tech from './tech';
import * as Dom from '../utils/dom.js';
import * as Url from '../utils/url.js';
import { createTimeRange } from '../utils/time-ranges.js';
import Component from '../component';
import window from 'global/window';
import assign from 'object.assign';

let navigator = window.navigator;
/**
 * Webfire  Media Controller - Wrapper for fallback EXE API
 *
 * @param {Object=} options Object of option names and values
 * @param {Function=} ready Ready callback function
 * @extends Tech
 * @class Webfire
 */
class Webfire extends Tech {

    constructor(options, ready) {
        super(options, ready);

        // Set the source when ready
        if (options.source) {
            this.ready(function () {
                this.setSource(options.source);
            }, true);
        }

        // Having issues with Webfire reloading on certain page actions (hide/resize/fullscreen) in certain browsers
        // This allows resetting the playhead when we catch the reload
        if (options.startTime) {
            this.ready(function () {
                this.load();
                this.play();
                this.currentTime(options.startTime);
            }, true);
        }

        // Add global window functions that the swf expects
        // A 4.x workflow we weren't able to solve for in 5.0
        // because of the need to hard code these functions
        // into the swf for security reasons
        window.videojs = window.videojs || {};
        window.videojs.Webfire = window.videojs.Webfire || {};
        window.videojs.Webfire.onReady = Webfire.onReady;
        window.videojs.Webfire.onEvent = Webfire.onEvent;
        window.videojs.Webfire.onError = Webfire.onError;

        this.on('seeked', function () {
            this.lastSeekTarget_ = undefined;
        });
    }

    /**
     * Create the component's DOM element
     *
     * @return {Element}
     * @method createEl
     */
    createEl() {
        let options = this.options_;

        // should no used...
        if (!options.exe) {
            options.exe = '/plugin/npWebFire.exe';
        }

        // Generate ID for plugin object
        let objId = options.techId;

        // Merge default webFireVars with ones passed in to init
        let webFireVars = assign({

            // EXE Callback Functions
            'readyFunction': 'videojs.Webfire.onReady',
            'eventProxyFunction': 'videojs.Webfire.onEvent',
            'errorEventProxyFunction': 'videojs.Webfire.onError',

            // Player Settings
            'autoplay': options.autoplay,
            'preload': options.preload,
            'loop': options.loop,
            'muted': options.muted

        }, options.webFireVars);

        // Merge default parames with ones passed in
        let params = assign({
            'onload': 'webfireOnload',
            'wmode': 'opaque', // Opaque is needed to overlay controls, but can affect playback performance
            'bgcolor': '#000000' // Using bgcolor prevents a white flash when the object is loading
        }, options.params);

        // Merge default attributes with ones passed in
        let attributes = assign({
            'id': objId,
            'name': objId, // Both ID and Name needed or swf to identify itself
            'class': 'vjs-tech'
        }, options.attributes);

        this.el_ = Webfire.embed(options.exe, webFireVars, params, attributes);
        this.el_.tech = this;

        return this.el_;
    }

    play() {
        if (this.ended()) {
            this.setCurrentTime(0);
        }
        this.el_.vjs_play();
    }

    pause() {
        this.el_.vjs_pause();
    }

    stop() {
        this.setCurrentTime(0);
        this.el_.vjs_stop();
    }

    snapshot(lng) {
        this.el_.vjs_snapshot(lng);
    }

    digitalzoom(type) {
        this.el_.vjs_digitalzoom(type);
    }

    pageTurning(type) {
        this.el_.vjs_pageTurning(type);
    }

    playOne(type) {
        if (type === undefined){
            return;
        }
        this.el_.vjs_playOne(type.index, type.value);
    }

    stopOne(idx) {
        this.el_.vjs_stopOne(idx);
    }

    jumpTo(type) {
        if (type === undefined){
            return;
        }
        this.el_.vjs_jumpTo(type.index, type.value);
    }

    speedControl(type) {
        if (type === undefined){
            return;
        }
        this.el_.vjs_speedControl(type.index, type.value, type.speed);
    }

    src(src) {
        if (src === undefined) {
            return this.currentSrc();
        }

        // Setting src through `src` not `setSrc` will be deprecated
        return this.setSrc(src);
    }

    setSrc(src) {
        // Make sure source URL is absolute.
        //src = Url.getAbsoluteURL(src);
        this.el_.vjs_src(src);

        // Currently the SWF doesn't autoplay if you load a source later.
        // e.g. Load player w/ no source, wait 2s, set src.
        if (this.autoplay()) {
            var tech = this;
            this.setTimeout(function () { tech.play(); }, 0);
        }
    }

    seeking() {
        return this.lastSeekTarget_ !== undefined;
    }

    setCurrentTime(time) {
        let seekable = this.seekable();
        if (seekable.length) {
            // clamp to the current seekable range
            time = time > seekable.start(0) ? time : seekable.start(0);
            time = time < seekable.end(seekable.length - 1) ? time : seekable.end(seekable.length - 1);

            this.lastSeekTarget_ = time;
            this.trigger('seeking');
            this.el_.vjs_setProperty('currentTime', time);
            super.setCurrentTime();
        }
    }

    currentTime(time) {
        // when seeking make the reported time keep up with the requested time
        // by reading the time we're seeking to
        if (this.seeking()) {
            return this.lastSeekTarget_ || 0;
        }
        return this.el_.vjs_getProperty('currentTime');
    }

    currentSrc() {
        if (this.currentSource_) {
            return this.currentSource_.src;
        } else {
            return this.el_.vjs_getProperty('currentSrc');
        }
    }

    load() {
        this.el_.vjs_load();
    }

    poster() {
        this.el_.vjs_getProperty('poster');
    }

    setPoster() { }

    seekable() {
        const duration = this.duration();
        if (duration === 0) {
            return createTimeRange();
        }
        return createTimeRange(0, duration);
    }

    buffered() {
        let ranges;

        try {
            ranges = this.el_.vjs_getProperty('buffered');
        } catch (error) {
            //throw error;
            return createTimeRange();
        }
        if(ranges === undefined){
            return createTimeRange();
        }
        if (ranges.length === 0) {
            return createTimeRange();
        }
        return createTimeRange(ranges[0][0], ranges[0][1]);
    }

    bufferLength(value) {
        if (value === undefined) {
            return this.el_.vjs_getProperty('bufferLength');
        }

        return this.setbufferLength(value);
    }

    setbufferLength(value) {
        this.el_.vjs_setProperty('bufferLength', value);
    }

    quarkMode(value) {
        if (value === undefined) {
            return this.el_.vjs_getProperty('quarkMode');
        }

        return this.setquarkMode(value);
    }

    setquarkMode(value) {
        this.el_.vjs_setProperty('quarkMode', value);
    }

    channelMax(value) {
        if (value === undefined) {
            return this.el_.vjs_getProperty('channelMax');
        }

        return this.setchannelMax(value);
    }

    setchannelMax(value) {
        this.el_.vjs_setProperty('channelMax', value);
    }

    activeChannel(value) {
        if (value === undefined) {
            return this.el_.vjs_getProperty('activePlayWnd');
        }

        return this.setactiveChannel(value);
    }

    setactiveChannel(value) {
        this.el_.vjs_setProperty('activePlayWnd', value);
    }

    supportsFullScreen() {
        return false; // TODO
    }

    enterFullScreen() {
        return false;
    }
}

// Create setters and getters for attributes
const _api = Webfire.prototype;
const _readWrite = 'preload,defaultPlaybackRate,playbackRate,autoplay,loop,mediaGroup,controller,controls,volume,muted,defaultMuted,maxPlayWnd,activePlayWnd'.split(',');
const _readOnly = 'networkState,readyState,initialTime,duration,startOffsetTime,paused,ended,videoTracks,audioTracks,videoWidth,videoHeight,maxPlayWnd,activePlayWnd'.split(',');

function _createSetter(attr) {
    var attrUpper = attr.charAt(0).toUpperCase() + attr.slice(1);
    _api['set' + attrUpper] = function (val) { return this.el_.vjs_setProperty(attr, val); };
}
function _createGetter(attr) {
    _api[attr] = function () { return this.el_.vjs_getProperty(attr); };
}

// Create getter and setters for all read/write attributes
for (let i = 0; i < _readWrite.length; i++) {
    _createGetter(_readWrite[i]);
    _createSetter(_readWrite[i]);
}

// Create getters for read-only attributes
for (let i = 0; i < _readOnly.length; i++) {
    _createGetter(_readOnly[i]);
}

/* Webfire Support Testing -------------------------------------------------------- */

Webfire.isSupported = function () {
    //console.log('Webfire.version:' + Webfire.version()[0]);
    return Webfire.version()[0] >= 1;
    //return true;
};

// Add Source Handler pattern functions to this tech
Tech.withSourceHandlers(Webfire);

Webfire.nativeSourceHandler = {};

Webfire.nativeSourceHandler.canPlayType = function (type) {
    if (type in Webfire.formats) {
        return 'maybe';
    }

    return '';
};

Webfire.nativeSourceHandler.canHandleSource = function (source) {
    var type;

    function guessMimeType(src) {
        var ext = Url.getFileExtension(src);
        if (ext) {
            return `video/${ext}`;
        }
        return '';
    }

    if (!source.type) {
        type = guessMimeType(source.src);
    } else {
        // Strip code information from the type because we don't get that specific
        type = source.type.replace(/;.*/, '').toLowerCase();
    }

    return Webfire.nativeSourceHandler.canPlayType(type);
};

Webfire.nativeSourceHandler.handleSource = function (source, tech) {
    tech.setSrc(source.src);
};

/*
 * Clean up the source handler when disposing the player or switching sources..
 * (no cleanup is needed when supporting the format natively)
 */
Webfire.nativeSourceHandler.dispose = function () { };

// Register the native source handler
Webfire.registerSourceHandler(Webfire.nativeSourceHandler);

Webfire.formats = {
    'video/hbv': 'hbv',
    'hbgk/raw': 'raw'
};

Webfire.onReady = function (currExe) {
    //console.log('Webfire.onReady!');
    let el = Dom.getEl(currExe + '_Webfire_api');
    let tech = el && el.tech;

    // if there is no el then the tech has been disposed
    // and the tech element was removed from the player div
    if (tech && tech.el()) {
        // check that the exe object is really ready
        Webfire.checkReady(tech);
    }
};

// The EXE isn't always ready when it says it is. Sometimes the API functions still need to be added to the object.
// If it's not ready, we set a timeout to check again shortly.
Webfire.checkReady = function (tech) {
    // stop worrying if the tech has been disposed
    if (!tech.el()) {
        return;
    }

    // check if API property exists
    if (tech.el().vjs_getProperty) {
        // tell tech it's ready
        tech.triggerReady();
    } else {
        // wait longer
        this.setTimeout(function () {
            Webfire['checkReady'](tech);
        }, 50);
    }
};

// Trigger events from the exe on the player
Webfire.onEvent = function (exeID, eventName) {
    let tech = Dom.getEl(exeID).tech;
    tech.trigger(eventName);
};

// Log errors from the exe
Webfire.onError = function (exeID, err) {
    const tech = Dom.getEl(exeID).tech;

    // trigger MEDIA_ERR_SRC_NOT_SUPPORTED
    if (err === 'srcnotfound') {
        return tech.error(4);
    }

    // trigger a custom error
    tech.error('WEBFIRE: ' + err);
};

// Webfire Version Check
Webfire.version = function () {
    let version = '0,0,0';

    // IE
    try {
        version = new window.ActiveXObject('WebFire.WebFire').version.replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];

        // other browsers
    } catch (e) {
        try {
            if (navigator.mimeTypes['application/x-webfire'].enabledPlugin) {
                version = (navigator.plugins['WebFire']).version.replace(/\D+/g, ',').match(/^,?(.+),?$/)[1];
            }
        } catch (err) { }
    }
    return version.split(',');
};

// Webfire embedding method. Only used in non-iframe mode
Webfire.embed = function (exe, webFireVars, params, attributes) {
    const code = Webfire.getEmbedCode(exe, webFireVars, params, attributes);

    // Get element by embedding code and retrieving created element
    const obj = Dom.createEl('div', { innerHTML: code }).childNodes[0];

    return obj;
};

Webfire.getEmbedCode = function (exe, webFireVars, params, attributes) {
    const objTag = '<object type="application/x-webfire" ';
    let flashVarsString = '';
    let paramsString = '';
    let attrsString = '';

    // Convert flash vars to string
    if (webFireVars) {
        Object.getOwnPropertyNames(webFireVars).forEach(function (key) {
            flashVarsString += `${key}=${webFireVars[key]}&amp;`;
        });
    }

    // Add exe, webFireVars, and other default params
    params = assign({
        //'movie': exe,
        'webfirevars': flashVarsString,
        'allowScriptAccess': 'always', // Required to talk to exe
        'allowNetworking': 'all' // All should be default, but having security issues.
    }, params);

    // Create param tags string
    Object.getOwnPropertyNames(params).forEach(function (key) {
        paramsString += `<param name="${key}" value="${params[key]}" />`;
    });

    attributes = assign({
        // Add exe to attributes (need both for IE and Others to work)
        //'data': exe,

        // Default to 100% width/height
        'width': '100%',
        'height': '100%'

    }, attributes);

    // Create Attributes string
    Object.getOwnPropertyNames(attributes).forEach(function (key) {
        attrsString += `${key}="${attributes[key]}" `;
    });

    return `${objTag}${attrsString}>${paramsString}</object>`;
};

Component.registerComponent('Webfire', Webfire);
Tech.registerTech('Webfire', Webfire);
export default Webfire;