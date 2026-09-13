(function(){
let translateObjs = {};
const trans = (...a) => {
    return translateObjs[a[0x0]] = a, '';
};
function regTextVar(a, b) {
    var c = ![];
    return d(b);
    function d(k, l) {
        switch (k['toLowerCase']()) {
        case 'title':
        case 'subtitle':
        case 'photo.title':
        case 'photo.description':
            var m = (function () {
                switch (k['toLowerCase']()) {
                case 'title':
                case 'photo.title':
                    return 'media.label';
                case 'subtitle':
                    return 'media.data.subtitle';
                case 'photo.description':
                    return 'media.data.description';
                }
            }());
            if (m)
                return function () {
                    var r, s, t = (l && l['viewerName'] ? this['getComponentByName'](l['viewerName']) : undefined) || this['getMainViewer']();
                    if (k['toLowerCase']()['startsWith']('photo'))
                        r = this['getByClassName']('PhotoAlbumPlayListItem')['filter'](function (v) {
                            var w = v['get']('player');
                            return w && w['get']('viewerArea') == t;
                        })['map'](function (v) {
                            return v['get']('media')['get']('playList');
                        });
                    else
                        r = this['_getPlayListsWithViewer'](t), s = j['bind'](this, t);
                    if (!c) {
                        for (var u = 0x0; u < r['length']; ++u) {
                            r[u]['bind']('changing', f, this);
                        }
                        c = !![];
                    }
                    return i['call'](this, r, m, s);
                };
            break;
        case 'tour.name':
        case 'tour.description':
            return function () {
                return this['get']('data')['tour']['locManager']['trans'](k);
            };
        default:
            if (k['toLowerCase']()['startsWith']('viewer.')) {
                var n = k['split']('.')['map'](function (r) {
                        return r['trim']();
                    }), o = n[0x1];
                if (o) {
                    var p = n['slice'](0x2)['join']('.');
                    return d(p, { 'viewerName': o });
                }
            } else {
                if (k['toLowerCase']()['startsWith']('quiz.') && 'Quiz' in TDV) {
                    var q = undefined, m = (function () {
                            switch (k['toLowerCase']()) {
                            case 'quiz.questions.answered':
                                return TDV['Quiz']['PROPERTY']['QUESTIONS_ANSWERED'];
                            case 'quiz.question.count':
                                return TDV['Quiz']['PROPERTY']['QUESTION_COUNT'];
                            case 'quiz.items.found':
                                return TDV['Quiz']['PROPERTY']['ITEMS_FOUND'];
                            case 'quiz.item.count':
                                return TDV['Quiz']['PROPERTY']['ITEM_COUNT'];
                            case 'quiz.score':
                                return TDV['Quiz']['PROPERTY']['SCORE'];
                            case 'quiz.score.total':
                                return TDV['Quiz']['PROPERTY']['TOTAL_SCORE'];
                            case 'quiz.time.remaining':
                                return TDV['Quiz']['PROPERTY']['REMAINING_TIME'];
                            case 'quiz.time.elapsed':
                                return TDV['Quiz']['PROPERTY']['ELAPSED_TIME'];
                            case 'quiz.time.limit':
                                return TDV['Quiz']['PROPERTY']['TIME_LIMIT'];
                            case 'quiz.media.items.found':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_ITEMS_FOUND'];
                            case 'quiz.media.item.count':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_ITEM_COUNT'];
                            case 'quiz.media.questions.answered':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_QUESTIONS_ANSWERED'];
                            case 'quiz.media.question.count':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_QUESTION_COUNT'];
                            case 'quiz.media.score':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_SCORE'];
                            case 'quiz.media.score.total':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_TOTAL_SCORE'];
                            case 'quiz.media.index':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_INDEX'];
                            case 'quiz.media.count':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_COUNT'];
                            case 'quiz.media.visited':
                                return TDV['Quiz']['PROPERTY']['PANORAMA_VISITED_COUNT'];
                            default:
                                var s = /quiz\.([\w_]+)\.(.+)/['exec'](k);
                                if (s) {
                                    q = s[0x1];
                                    switch ('quiz.' + s[0x2]) {
                                    case 'quiz.score':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['SCORE'];
                                    case 'quiz.score.total':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['TOTAL_SCORE'];
                                    case 'quiz.media.items.found':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['PANORAMA_ITEMS_FOUND'];
                                    case 'quiz.media.item.count':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['PANORAMA_ITEM_COUNT'];
                                    case 'quiz.media.questions.answered':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['PANORAMA_QUESTIONS_ANSWERED'];
                                    case 'quiz.media.question.count':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['PANORAMA_QUESTION_COUNT'];
                                    case 'quiz.questions.answered':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['QUESTIONS_ANSWERED'];
                                    case 'quiz.question.count':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['QUESTION_COUNT'];
                                    case 'quiz.items.found':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['ITEMS_FOUND'];
                                    case 'quiz.item.count':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['ITEM_COUNT'];
                                    case 'quiz.media.score':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['PANORAMA_SCORE'];
                                    case 'quiz.media.score.total':
                                        return TDV['Quiz']['OBJECTIVE_PROPERTY']['PANORAMA_TOTAL_SCORE'];
                                    }
                                }
                            }
                        }());
                    if (m)
                        return function () {
                            var r = this['get']('data')['quiz'];
                            if (r) {
                                if (!c) {
                                    if (q != undefined) {
                                        if (q == 'global') {
                                            var s = this['get']('data')['quizConfig'], t = s['objectives'];
                                            for (var u = 0x0, v = t['length']; u < v; ++u) {
                                                r['bind'](TDV['Quiz']['EVENT_OBJECTIVE_PROPERTIES_CHANGE'], h['call'](this, t[u]['id'], m), this);
                                            }
                                        } else
                                            r['bind'](TDV['Quiz']['EVENT_OBJECTIVE_PROPERTIES_CHANGE'], h['call'](this, q, m), this);
                                    } else
                                        r['bind'](TDV['Quiz']['EVENT_PROPERTIES_CHANGE'], g['call'](this, m), this);
                                    c = !![];
                                }
                                try {
                                    var w = 0x0;
                                    if (q != undefined) {
                                        if (q == 'global') {
                                            var s = this['get']('data')['quizConfig'], t = s['objectives'];
                                            for (var u = 0x0, v = t['length']; u < v; ++u) {
                                                w += r['getObjective'](t[u]['id'], m);
                                            }
                                        } else
                                            w = r['getObjective'](q, m);
                                    } else {
                                        w = r['get'](m);
                                        if (m == TDV['Quiz']['PROPERTY']['PANORAMA_INDEX'])
                                            w += 0x1;
                                    }
                                    return w;
                                } catch (x) {
                                    return undefined;
                                }
                            }
                        };
                }
            }
            break;
        }
        return function () {
            return '';
        };
    }
    function e() {
        var k = this['get']('data');
        k['updateText'](k['translateObjs'][a], a['split']('.')[0x0]);
        let l = a['split']('.'), m = l[0x0] + '_vr';
        m in this && k['updateText'](k['translateObjs'][a], m);
    }
    function f(k) {
        var l = k['data']['nextSelectedIndex'];
        if (l >= 0x0) {
            var m = k['source']['get']('items')[l], n = function () {
                    m['unbind']('begin', n, this, !![]), e['call'](this);
                };
            m['bind']('begin', n, this, !![]);
        }
    }
    function g(k) {
        return function (l) {
            k in l && e['call'](this);
        }['bind'](this);
    }
    function h(k, l) {
        return function (m, n) {
            k == m && l in n && e['call'](this);
        }['bind'](this);
    }
    function i(k, l, m) {
        for (var n = 0x0; n < k['length']; ++n) {
            var o = k[n], p = o['get']('selectedIndex');
            if (p >= 0x0) {
                var q = l['split']('.'), r = o['get']('items')[p];
                if (m !== undefined && !m['call'](this, r))
                    continue;
                for (var s = 0x0; s < q['length']; ++s) {
                    if (r == undefined)
                        return '';
                    r = 'get' in r ? r['get'](q[s]) : r[q[s]];
                }
                return r;
            }
        }
        return '';
    }
    function j(k, l) {
        var m = l['get']('player');
        return m !== undefined && m['get']('viewerArea') == k;
    }
}
var script = {"children":["this.MainViewer"],"minHeight":0,"start":"this.init()","id":"rootPlayer","minWidth":0,"data":{"history":{},"displayTooltipInTouchScreens":true,"textToSpeechConfig":{"pitch":1,"stopBackgroundAudio":false,"rate":1,"speechOnInfoWindow":false,"speechOnTooltip":false,"volume":1,"speechOnQuizQuestion":false},"locales":{"en":"locale/en.txt"},"name":"Player484","defaultLocale":"en"},"backgroundColor":["#FFFFFF"],"scripts":{"visibleComponentsIfPlayerFlagEnabled":TDV.Tour.Script.visibleComponentsIfPlayerFlagEnabled,"stopTextToSpeech":TDV.Tour.Script.stopTextToSpeech,"getGlobalAudio":TDV.Tour.Script.getGlobalAudio,"setLocale":TDV.Tour.Script.setLocale,"updateVideoCues":TDV.Tour.Script.updateVideoCues,"_initTwinsViewer":TDV.Tour.Script._initTwinsViewer,"getCurrentPlayers":TDV.Tour.Script.getCurrentPlayers,"openLink":TDV.Tour.Script.openLink,"showPopupImage":TDV.Tour.Script.showPopupImage,"stopGlobalAudio":TDV.Tour.Script.stopGlobalAudio,"initQuiz":TDV.Tour.Script.initQuiz,"setDirectionalPanoramaAudio":TDV.Tour.Script.setDirectionalPanoramaAudio,"clone":TDV.Tour.Script.clone,"updateMediaLabelFromPlayList":TDV.Tour.Script.updateMediaLabelFromPlayList,"shareSocial":TDV.Tour.Script.shareSocial,"showComponentsWhileMouseOver":TDV.Tour.Script.showComponentsWhileMouseOver,"getCurrentPlayerWithMedia":TDV.Tour.Script.getCurrentPlayerWithMedia,"initOverlayGroupRotationOnClick":TDV.Tour.Script.initOverlayGroupRotationOnClick,"_initSplitViewer":TDV.Tour.Script._initSplitViewer,"getComponentByName":TDV.Tour.Script.getComponentByName,"mixObject":TDV.Tour.Script.mixObject,"getActivePlayersWithViewer":TDV.Tour.Script.getActivePlayersWithViewer,"initAnalytics":TDV.Tour.Script.initAnalytics,"getAudioByTags":TDV.Tour.Script.getAudioByTags,"getActivePlayerWithViewer":TDV.Tour.Script.getActivePlayerWithViewer,"textToSpeech":TDV.Tour.Script.textToSpeech,"skip3DTransitionOnce":TDV.Tour.Script.skip3DTransitionOnce,"getActiveMediaWithViewer":TDV.Tour.Script.getActiveMediaWithViewer,"getPixels":TDV.Tour.Script.getPixels,"stopGlobalAudios":TDV.Tour.Script.stopGlobalAudios,"resumeGlobalAudios":TDV.Tour.Script.resumeGlobalAudios,"getKey":TDV.Tour.Script.getKey,"resumePlayers":TDV.Tour.Script.resumePlayers,"setStartTimeVideoSync":TDV.Tour.Script.setStartTimeVideoSync,"updateDeepLink":TDV.Tour.Script.updateDeepLink,"htmlToPlainText":TDV.Tour.Script.htmlToPlainText,"setStartTimeVideo":TDV.Tour.Script.setStartTimeVideo,"updateIndexGlobalZoomImage":TDV.Tour.Script.updateIndexGlobalZoomImage,"historyGoForward":TDV.Tour.Script.historyGoForward,"quizResumeTimer":TDV.Tour.Script.quizResumeTimer,"historyGoBack":TDV.Tour.Script.historyGoBack,"quizPauseTimer":TDV.Tour.Script.quizPauseTimer,"setSurfaceSelectionHotspotMode":TDV.Tour.Script.setSurfaceSelectionHotspotMode,"unloadViewer":TDV.Tour.Script.unloadViewer,"executeFunctionWhenChange":TDV.Tour.Script.executeFunctionWhenChange,"getRootOverlay":TDV.Tour.Script.getRootOverlay,"showPopupMedia":TDV.Tour.Script.showPopupMedia,"executeJS":TDV.Tour.Script.executeJS,"getQuizTotalObjectiveProperty":TDV.Tour.Script.getQuizTotalObjectiveProperty,"isComponentVisible":TDV.Tour.Script.isComponentVisible,"getMainViewer":TDV.Tour.Script.getMainViewer,"setPanoramaCameraWithSpot":TDV.Tour.Script.setPanoramaCameraWithSpot,"triggerOverlay":TDV.Tour.Script.triggerOverlay,"getPlayListsWithMedia":TDV.Tour.Script.getPlayListsWithMedia,"getPlayListItemIndexByMedia":TDV.Tour.Script.getPlayListItemIndexByMedia,"quizFinish":TDV.Tour.Script.quizFinish,"init":TDV.Tour.Script.init,"getStateTextToSpeech":TDV.Tour.Script.getStateTextToSpeech,"executeAudioAction":TDV.Tour.Script.executeAudioAction,"getPlayListItems":TDV.Tour.Script.getPlayListItems,"executeAudioActionByTags":TDV.Tour.Script.executeAudioActionByTags,"setPlayListSelectedIndex":TDV.Tour.Script.setPlayListSelectedIndex,"getPlayListItemByMedia":TDV.Tour.Script.getPlayListItemByMedia,"createTween":TDV.Tour.Script.createTween,"getFirstPlayListWithMedia":TDV.Tour.Script.getFirstPlayListWithMedia,"quizShowQuestion":TDV.Tour.Script.quizShowQuestion,"createTweenModel3D":TDV.Tour.Script.createTweenModel3D,"getPlayListWithItem":TDV.Tour.Script.getPlayListWithItem,"downloadFile":TDV.Tour.Script.downloadFile,"setPanoramaCameraWithCurrentSpot":TDV.Tour.Script.setPanoramaCameraWithCurrentSpot,"toggleTextToSpeechComponent":TDV.Tour.Script.toggleTextToSpeechComponent,"quizSetItemFound":TDV.Tour.Script.quizSetItemFound,"setOverlaysVisibilityByTags":TDV.Tour.Script.setOverlaysVisibilityByTags,"textToSpeechComponent":TDV.Tour.Script.textToSpeechComponent,"copyToClipboard":TDV.Tour.Script.copyToClipboard,"setOverlaysVisibility":TDV.Tour.Script.setOverlaysVisibility,"copyObjRecursively":TDV.Tour.Script.copyObjRecursively,"setOverlayBehaviour":TDV.Tour.Script.setOverlayBehaviour,"clonePanoramaCamera":TDV.Tour.Script.clonePanoramaCamera,"setObjectsVisibilityByTags":TDV.Tour.Script.setObjectsVisibilityByTags,"playGlobalAudio":TDV.Tour.Script.playGlobalAudio,"_getPlayListsWithViewer":TDV.Tour.Script._getPlayListsWithViewer,"cloneBindings":TDV.Tour.Script.cloneBindings,"setObjectsVisibilityByID":TDV.Tour.Script.setObjectsVisibilityByID,"playGlobalAudioWhilePlay":TDV.Tour.Script.playGlobalAudioWhilePlay,"restartTourWithoutInteraction":TDV.Tour.Script.restartTourWithoutInteraction,"setMapLocation":TDV.Tour.Script.setMapLocation,"playGlobalAudioWhilePlayActiveMedia":TDV.Tour.Script.playGlobalAudioWhilePlayActiveMedia,"playAudioList":TDV.Tour.Script.playAudioList,"setObjectsVisibility":TDV.Tour.Script.setObjectsVisibility,"syncPlaylists":TDV.Tour.Script.syncPlaylists,"setMeasurementUnits":TDV.Tour.Script.setMeasurementUnits,"pauseGlobalAudios":TDV.Tour.Script.pauseGlobalAudios,"getPanoramaOverlaysByTags":TDV.Tour.Script.getPanoramaOverlaysByTags,"stopAndGoCamera":TDV.Tour.Script.stopAndGoCamera,"toggleMeasurementsVisibility":TDV.Tour.Script.toggleMeasurementsVisibility,"pauseGlobalAudio":TDV.Tour.Script.pauseGlobalAudio,"getPanoramaOverlayByName":TDV.Tour.Script.getPanoramaOverlayByName,"setMeasurementsVisibility":TDV.Tour.Script.setMeasurementsVisibility,"setModel3DCameraSequence":TDV.Tour.Script.setModel3DCameraSequence,"pauseGlobalAudiosWhilePlayItem":TDV.Tour.Script.pauseGlobalAudiosWhilePlayItem,"cleanSelectedMeasurements":TDV.Tour.Script.cleanSelectedMeasurements,"setModel3DCameraWithCurrentSpot":TDV.Tour.Script.setModel3DCameraWithCurrentSpot,"pauseCurrentPlayers":TDV.Tour.Script.pauseCurrentPlayers,"getOverlaysByGroupname":TDV.Tour.Script.getOverlaysByGroupname,"cleanAllMeasurements":TDV.Tour.Script.cleanAllMeasurements,"changePlayListWithSameSpot":TDV.Tour.Script.changePlayListWithSameSpot,"getOverlaysByTags":TDV.Tour.Script.getOverlaysByTags,"toggleMeasurement":TDV.Tour.Script.toggleMeasurement,"setModel3DCameraSpot":TDV.Tour.Script.setModel3DCameraSpot,"changeOpacityWhilePlay":TDV.Tour.Script.changeOpacityWhilePlay,"getOverlays":TDV.Tour.Script.getOverlays,"takeScreenshot":TDV.Tour.Script.takeScreenshot,"setMediaBehaviour":TDV.Tour.Script.setMediaBehaviour,"changeBackgroundWhilePlay":TDV.Tour.Script.changeBackgroundWhilePlay,"setMainMediaByName":TDV.Tour.Script.setMainMediaByName,"openEmbeddedPDF":TDV.Tour.Script.openEmbeddedPDF,"_getObjectsByTags":TDV.Tour.Script._getObjectsByTags,"autotriggerAtStart":TDV.Tour.Script.autotriggerAtStart,"setMainMediaByIndex":TDV.Tour.Script.setMainMediaByIndex,"startMeasurement":TDV.Tour.Script.startMeasurement,"unregisterKey":TDV.Tour.Script.unregisterKey,"loadFromCurrentMediaPlayList":TDV.Tour.Script.loadFromCurrentMediaPlayList,"assignObjRecursively":TDV.Tour.Script.assignObjRecursively,"stopMeasurement":TDV.Tour.Script.stopMeasurement,"existsKey":TDV.Tour.Script.existsKey,"getModel3DInnerObject":TDV.Tour.Script.getModel3DInnerObject,"fixTogglePlayPauseButton":TDV.Tour.Script.fixTogglePlayPauseButton,"startPanoramaWithModel":TDV.Tour.Script.startPanoramaWithModel,"getMediaHeight":TDV.Tour.Script.getMediaHeight,"startPanoramaWithCamera":TDV.Tour.Script.startPanoramaWithCamera,"getMediaFromPlayer":TDV.Tour.Script.getMediaFromPlayer,"getMediaWidth":TDV.Tour.Script.getMediaWidth,"_initItemWithComps":TDV.Tour.Script._initItemWithComps,"setValue":TDV.Tour.Script.setValue,"_initTTSTooltips":TDV.Tour.Script._initTTSTooltips,"setEndToItemIndex":TDV.Tour.Script.setEndToItemIndex,"quizShowTimeout":TDV.Tour.Script.quizShowTimeout,"quizShowScore":TDV.Tour.Script.quizShowScore,"getComponentsByTags":TDV.Tour.Script.getComponentsByTags,"keepCompVisible":TDV.Tour.Script.keepCompVisible,"setComponentsVisibilityByTags":TDV.Tour.Script.setComponentsVisibilityByTags,"registerKey":TDV.Tour.Script.registerKey,"showWindowBase":TDV.Tour.Script.showWindowBase,"setComponentVisibility":TDV.Tour.Script.setComponentVisibility,"startModel3DWithCameraSpot":TDV.Tour.Script.startModel3DWithCameraSpot,"translate":TDV.Tour.Script.translate,"isPanorama":TDV.Tour.Script.isPanorama,"setCameraSameSpotAsMedia":TDV.Tour.Script.setCameraSameSpotAsMedia,"isCardboardViewMode":TDV.Tour.Script.isCardboardViewMode,"getMediaByTags":TDV.Tour.Script.getMediaByTags,"showWindow":TDV.Tour.Script.showWindow,"disableVR":TDV.Tour.Script.disableVR,"showPopupPanoramaVideoOverlay":TDV.Tour.Script.showPopupPanoramaVideoOverlay,"sendAnalyticsData":TDV.Tour.Script.sendAnalyticsData,"showPopupPanoramaOverlay":TDV.Tour.Script.showPopupPanoramaOverlay,"enableVR":TDV.Tour.Script.enableVR,"quizStart":TDV.Tour.Script.quizStart,"toggleVR":TDV.Tour.Script.toggleVR,"getMediaByName":TDV.Tour.Script.getMediaByName},"scrollBarColor":"#000000","xrPanelsEnabled":true,"backgroundColorRatios":[0],"hash": "2851881dd8d53693137c0a9eb832db1564736403f3d49f5068bf834b5a65cc70", "definitions": [{"progressBarBorderSize":0,"progressBarBorderRadius":2,"toolTipFontFamily":"Arial","playbackBarBottom":5,"toolTipBackgroundColor":"#F6F6F6","firstTransitionDuration":0,"vrPointerColor":"#FFFFFF","progressBorderRadius":2,"playbackBarHeight":10,"progressLeft":"33%","playbackBarBackgroundColor":["#FFFFFF"],"playbackBarHeadShadowHorizontalLength":0,"playbackBarProgressBorderSize":0,"playbackBarHeadWidth":6,"playbackBarBackgroundColorDirection":"vertical","playbackBarRight":0,"subtitlesFontFamily":"Arial","toolTipBorderColor":"#767676","playbackBarProgressBackgroundColor":["#3399FF"],"playbackBarProgressBorderRadius":0,"data":{"name":"Main Viewer"},"toolTipFontColor":"#606060","playbackBarHeadShadowVerticalLength":0,"toolTipShadowColor":"#333138","surfaceReticleColor":"#FFFFFF","toolTipTextShadowColor":"#000000","subtitlesGap":0,"playbackBarHeadShadowOpacity":0.7,"playbackBarProgressBackgroundColorRatios":[0],"subtitlesBackgroundColor":"#000000","playbackBarBorderColor":"#FFFFFF","playbackBarBorderRadius":0,"playbackBarProgressBorderColor":"#000000","propagateClick":false,"toolTipPaddingRight":6,"subtitlesTextShadowVerticalLength":1,"vrPointerSelectionColor":"#FF6600","subtitlesTextShadowOpacity":1,"playbackBarHeadBorderRadius":0,"playbackBarHeadBorderColor":"#000000","minHeight":50,"surfaceReticleSelectionColor":"#FFFFFF","progressBackgroundColorRatios":[0],"subtitlesTop":0,"vrPointerSelectionTime":2000,"playbackBarBorderSize":0,"id":"MainViewer","minWidth":100,"toolTipPaddingTop":4,"toolTipPaddingLeft":6,"progressBarBackgroundColorRatios":[0],"toolTipPaddingBottom":4,"vrThumbstickRotationStep":20,"subtitlesFontSize":"3vmin","progressRight":"33%","progressOpacity":0.7,"playbackBarBackgroundOpacity":1,"subtitlesBackgroundOpacity":0.2,"progressBorderColor":"#000000","progressBarBorderColor":"#000000","playbackBarHeadShadowBlurRadius":3,"subtitlesTextShadowHorizontalLength":1,"class":"ViewerArea","subtitlesBorderColor":"#FFFFFF","progressBackgroundColor":["#000000"],"playbackBarHeadHeight":15,"toolTipFontSize":"1.11vmin","progressBarBackgroundColor":["#3399FF"],"progressBarBackgroundColorDirection":"horizontal","progressBottom":10,"subtitlesBottom":50,"playbackBarHeadShadow":true,"playbackBarLeft":0,"playbackBarHeadBorderSize":0,"subtitlesTextShadowColor":"#000000","playbackBarHeadBackgroundColorRatios":[0,1],"width":"100%","playbackBarHeadShadowColor":"#000000","progressHeight":2,"height":"100%","subtitlesFontColor":"#FFFFFF","playbackBarHeadBackgroundColor":["#111111","#666666"],"progressBorderSize":0},{"vfov":180,"adjacentPanoramas":[{"data":{"overlayID":"overlay_9616CCDF_9846_EFB2_41DB_95BB13CBCF72"},"distance":9.42,"yaw":158.65,"panorama":"this.panorama_92A160F1_9842_B78E_41E2_F31CD82E6215","backwardYaw":95.64,"select":"this.overlay_9616CCDF_9846_EFB2_41DB_95BB13CBCF72.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"}],"frames":[{"thumbnailUrl":"media/panorama_948B214E_9842_9695_41DB_6814BB31A577_t.webp","cube":{"levels":[{"colCount":48,"height":4096,"url":"media/panorama_948B214E_9842_9695_41DB_6814BB31A577_0/{face}/0/{row}_{column}.webp","tags":"ondemand","rowCount":8,"width":24576,"class":"TiledImageResourceLevel"},{"colCount":24,"height":2048,"url":"media/panorama_948B214E_9842_9695_41DB_6814BB31A577_0/{face}/1/{row}_{column}.webp","tags":"ondemand","rowCount":4,"width":12288,"class":"TiledImageResourceLevel"},{"colCount":12,"height":1024,"url":"media/panorama_948B214E_9842_9695_41DB_6814BB31A577_0/{face}/2/{row}_{column}.webp","tags":"ondemand","rowCount":2,"width":6144,"class":"TiledImageResourceLevel"},{"colCount":6,"height":512,"url":"media/panorama_948B214E_9842_9695_41DB_6814BB31A577_0/{face}/3/{row}_{column}.webp","tags":["ondemand","preload"],"rowCount":1,"width":3072,"class":"TiledImageResourceLevel"}],"class":"ImageResource"},"class":"CubicPanoramaFrame"}],"class":"Panorama","id":"panorama_948B214E_9842_9695_41DB_6814BB31A577","overlays":["this.overlay_9616CCDF_9846_EFB2_41DB_95BB13CBCF72"],"hfovMax":130,"data":{"label":"State Park River 0"},"hfov":360,"thumbnailUrl":"media/panorama_948B214E_9842_9695_41DB_6814BB31A577_t.webp","label":trans('panorama_948B214E_9842_9695_41DB_6814BB31A577.label')},{"initialSequence":"this.sequence_92B88F60_9842_6A8E_41B0_80E87C4F1626","initialPosition":{"pitch":0,"yaw":0,"class":"PanoramaCameraPosition"},"id":"panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_camera","enterPointingToHorizon":true,"class":"PanoramaCamera"},{"vfov":180,"adjacentPanoramas":[{"data":{"overlayID":"overlay_96C47962_9842_7692_41E0_EEF5B43E98E4"},"distance":41.58,"yaw":21.93,"panorama":"this.panorama_929C7898_9842_97BE_41D6_EC998B1C61C7","backwardYaw":-122.18,"select":"this.overlay_96C47962_9842_7692_41E0_EEF5B43E98E4.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"}],"frames":[{"thumbnailUrl":"media/panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_t.webp","cube":{"levels":[{"colCount":48,"height":4096,"url":"media/panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_0/{face}/0/{row}_{column}.webp","tags":"ondemand","rowCount":8,"width":24576,"class":"TiledImageResourceLevel"},{"colCount":24,"height":2048,"url":"media/panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_0/{face}/1/{row}_{column}.webp","tags":"ondemand","rowCount":4,"width":12288,"class":"TiledImageResourceLevel"},{"colCount":12,"height":1024,"url":"media/panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_0/{face}/2/{row}_{column}.webp","tags":"ondemand","rowCount":2,"width":6144,"class":"TiledImageResourceLevel"},{"colCount":6,"height":512,"url":"media/panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_0/{face}/3/{row}_{column}.webp","tags":["ondemand","preload"],"rowCount":1,"width":3072,"class":"TiledImageResourceLevel"}],"class":"ImageResource"},"class":"CubicPanoramaFrame"}],"class":"Panorama","id":"panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1","overlays":["this.overlay_96C47962_9842_7692_41E0_EEF5B43E98E4"],"hfovMax":130,"data":{"label":"State Park River 4"},"hfov":360,"thumbnailUrl":"media/panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_t.webp","label":trans('panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1.label')},{"mouseControlMode":"drag_rotation","keepModel3DLoadedWithoutLocation":true,"viewerArea":"this.MainViewer","aaEnabled":true,"displayPlaybackBar":true,"class":"PanoramaPlayer","arrowKeysAction":"translate","id":"MainViewerPanoramaPlayer","touchControlMode":"drag_rotation"},{"vfov":180,"adjacentPanoramas":[{"data":{"overlayID":"overlay_9625ACE6_9846_EF92_41AE_9C597C7A76BD"},"distance":17.37,"yaw":95.64,"panorama":"this.panorama_948B214E_9842_9695_41DB_6814BB31A577","backwardYaw":158.65,"select":"this.overlay_9625ACE6_9846_EF92_41AE_9C597C7A76BD.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"},{"data":{"overlayID":"overlay_962FF70D_9842_7A96_41B1_9AD82EE907FD"},"distance":16.43,"yaw":-80.04,"panorama":"this.panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F","backwardYaw":92.13,"select":"this.overlay_962FF70D_9842_7A96_41B1_9AD82EE907FD.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"}],"frames":[{"thumbnailUrl":"media/panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_t.webp","cube":{"levels":[{"colCount":48,"height":4096,"url":"media/panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_0/{face}/0/{row}_{column}.webp","tags":"ondemand","rowCount":8,"width":24576,"class":"TiledImageResourceLevel"},{"colCount":24,"height":2048,"url":"media/panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_0/{face}/1/{row}_{column}.webp","tags":"ondemand","rowCount":4,"width":12288,"class":"TiledImageResourceLevel"},{"colCount":12,"height":1024,"url":"media/panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_0/{face}/2/{row}_{column}.webp","tags":"ondemand","rowCount":2,"width":6144,"class":"TiledImageResourceLevel"},{"colCount":6,"height":512,"url":"media/panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_0/{face}/3/{row}_{column}.webp","tags":["ondemand","preload"],"rowCount":1,"width":3072,"class":"TiledImageResourceLevel"}],"class":"ImageResource"},"class":"CubicPanoramaFrame"}],"class":"Panorama","id":"panorama_92A160F1_9842_B78E_41E2_F31CD82E6215","overlays":["this.overlay_9625ACE6_9846_EF92_41AE_9C597C7A76BD","this.overlay_962FF70D_9842_7A96_41B1_9AD82EE907FD"],"hfovMax":130,"data":{"label":"State Park River 1"},"hfov":360,"thumbnailUrl":"media/panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_t.webp","label":trans('panorama_92A160F1_9842_B78E_41E2_F31CD82E6215.label')},{"initialSequence":"this.sequence_92B8DF60_9842_6A8E_41E2_99C3293D3105","initialPosition":{"pitch":0,"yaw":-56.95,"class":"PanoramaCameraPosition"},"id":"panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_camera","enterPointingToHorizon":true,"class":"PanoramaCamera"},{"vfov":180,"adjacentPanoramas":[{"data":{"overlayID":"overlay_9639E961_9842_768E_41E1_80F31C9C0470"},"distance":17.07,"yaw":-122.18,"panorama":"this.panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1","backwardYaw":21.93,"select":"this.overlay_9639E961_9842_768E_41E1_80F31C9C0470.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"},{"data":{"overlayID":"overlay_962A30CD_9842_7797_41D1_FC45CA557F60"},"distance":14.3,"yaw":53.18,"panorama":"this.panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F","backwardYaw":-81.94,"select":"this.overlay_962A30CD_9842_7797_41D1_FC45CA557F60.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"}],"frames":[{"thumbnailUrl":"media/panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_t.webp","cube":{"levels":[{"colCount":48,"height":4096,"url":"media/panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_0/{face}/0/{row}_{column}.webp","tags":"ondemand","rowCount":8,"width":24576,"class":"TiledImageResourceLevel"},{"colCount":24,"height":2048,"url":"media/panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_0/{face}/1/{row}_{column}.webp","tags":"ondemand","rowCount":4,"width":12288,"class":"TiledImageResourceLevel"},{"colCount":12,"height":1024,"url":"media/panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_0/{face}/2/{row}_{column}.webp","tags":"ondemand","rowCount":2,"width":6144,"class":"TiledImageResourceLevel"},{"colCount":6,"height":512,"url":"media/panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_0/{face}/3/{row}_{column}.webp","tags":["ondemand","preload"],"rowCount":1,"width":3072,"class":"TiledImageResourceLevel"}],"class":"ImageResource"},"class":"CubicPanoramaFrame"}],"class":"Panorama","id":"panorama_929C7898_9842_97BE_41D6_EC998B1C61C7","overlays":["this.overlay_962A30CD_9842_7797_41D1_FC45CA557F60","this.overlay_9639E961_9842_768E_41E1_80F31C9C0470"],"hfovMax":130,"data":{"label":"State Park River 3"},"hfov":360,"thumbnailUrl":"media/panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_t.webp","label":trans('panorama_929C7898_9842_97BE_41D6_EC998B1C61C7.label')},{"initialSequence":"this.sequence_92B8BF60_9842_6A8E_41BB_37F3DCA18B6F","initialPosition":{"pitch":-1.02,"yaw":-57.48,"class":"PanoramaCameraPosition"},"id":"panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_camera","enterPointingToHorizon":true,"class":"PanoramaCamera"},{"initialPosition":{"pitch":-5.83,"yaw":-171.02,"class":"PanoramaCameraPosition"},"id":"panorama_948B214E_9842_9695_41DB_6814BB31A577_camera","enterPointingToHorizon":true,"class":"PanoramaCamera"},{"initialSequence":"this.sequence_92B85F60_9842_6A8E_41E2_80B19CEA41E5","initialPosition":{"pitch":-2.91,"yaw":-139.57,"class":"PanoramaCameraPosition"},"id":"panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_camera","enterPointingToHorizon":true,"class":"PanoramaCamera"},{"id":"mainPlayList","items":[{"media":"this.panorama_948B214E_9842_9695_41DB_6814BB31A577","player":"this.MainViewerPanoramaPlayer","camera":"this.panorama_948B214E_9842_9695_41DB_6814BB31A577_camera","begin":"this.setEndToItemIndex(this.mainPlayList, 0, 1)","class":"PanoramaPlayListItem"},{"media":"this.panorama_92A160F1_9842_B78E_41E2_F31CD82E6215","player":"this.MainViewerPanoramaPlayer","camera":"this.panorama_92A160F1_9842_B78E_41E2_F31CD82E6215_camera","begin":"this.setEndToItemIndex(this.mainPlayList, 1, 2)","class":"PanoramaPlayListItem"},{"media":"this.panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F","player":"this.MainViewerPanoramaPlayer","camera":"this.panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_camera","begin":"this.setEndToItemIndex(this.mainPlayList, 2, 3)","class":"PanoramaPlayListItem"},{"media":"this.panorama_929C7898_9842_97BE_41D6_EC998B1C61C7","player":"this.MainViewerPanoramaPlayer","camera":"this.panorama_929C7898_9842_97BE_41D6_EC998B1C61C7_camera","begin":"this.setEndToItemIndex(this.mainPlayList, 3, 4)","class":"PanoramaPlayListItem"},{"media":"this.panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1","end":"this.trigger('tourEnded')","player":"this.MainViewerPanoramaPlayer","camera":"this.panorama_929CB439_9842_7EFE_41D3_DB0F87B323D1_camera","begin":"this.setEndToItemIndex(this.mainPlayList, 4, 0)","class":"PanoramaPlayListItem"}],"class":"PlayList"},{"vfov":180,"adjacentPanoramas":[{"data":{"overlayID":"overlay_962CA0CD_9842_7797_41D3_979F6C59E584"},"distance":18.51,"yaw":-81.94,"panorama":"this.panorama_929C7898_9842_97BE_41D6_EC998B1C61C7","backwardYaw":53.18,"select":"this.overlay_962CA0CD_9842_7797_41D3_979F6C59E584.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"},{"data":{"overlayID":"overlay_9634770D_9842_7A96_41E1_61991B9D6564"},"distance":12.04,"yaw":92.13,"panorama":"this.panorama_92A160F1_9842_B78E_41E2_F31CD82E6215","backwardYaw":-80.04,"select":"this.overlay_9634770D_9842_7A96_41E1_61991B9D6564.get('areas').forEach(function(a){ a.trigger('click') })","class":"AdjacentPanorama"}],"frames":[{"thumbnailUrl":"media/panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_t.webp","cube":{"levels":[{"colCount":48,"height":4096,"url":"media/panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_0/{face}/0/{row}_{column}.webp","tags":"ondemand","rowCount":8,"width":24576,"class":"TiledImageResourceLevel"},{"colCount":24,"height":2048,"url":"media/panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_0/{face}/1/{row}_{column}.webp","tags":"ondemand","rowCount":4,"width":12288,"class":"TiledImageResourceLevel"},{"colCount":12,"height":1024,"url":"media/panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_0/{face}/2/{row}_{column}.webp","tags":"ondemand","rowCount":2,"width":6144,"class":"TiledImageResourceLevel"},{"colCount":6,"height":512,"url":"media/panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_0/{face}/3/{row}_{column}.webp","tags":["ondemand","preload"],"rowCount":1,"width":3072,"class":"TiledImageResourceLevel"}],"class":"ImageResource"},"class":"CubicPanoramaFrame"}],"class":"Panorama","id":"panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F","overlays":["this.overlay_9634770D_9842_7A96_41E1_61991B9D6564","this.overlay_962CA0CD_9842_7797_41D3_979F6C59E584"],"hfovMax":130,"data":{"label":"State Park River 2"},"hfov":360,"thumbnailUrl":"media/panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F_t.webp","label":trans('panorama_929C8CFC_9842_AF75_41D7_551A7BEC689F.label')},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver1"},"maps":[],"items":[{"pitch":-10.22,"vfov":5.73,"distance":100,"yaw":158.65,"data":{"label":"GoToStateParkRiver1"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":10.5,"image":"this.AnimatedImageResource_89057A3C_985E_AAF6_417D_3F17707BAB88"}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_9616CCDF_9846_EFB2_41DB_95BB13CBCF72","areas":["this.HotspotPanoramaOverlayArea_96AB4D3C_9846_EEF6_4195_805C994B59D2"],"enabledInVR":true},{"movements":[{"class":"DistancePanoramaCameraMovement","easing":"cubic_in","yawDelta":18.5,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","yawDelta":323,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","easing":"cubic_out","yawDelta":18.5,"yawSpeed":7.96}],"id":"sequence_92B88F60_9842_6A8E_41B0_80E87C4F1626","class":"PanoramaCameraSequence"},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver3"},"maps":[],"items":[{"pitch":-2.33,"vfov":4.3,"distance":100,"yaw":21.93,"data":{"label":"GoToStateParkRiver3"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":4.88,"image":"this.AnimatedImageResource_89030A3C_985E_AAF6_41CC_CF10DB5FAE13"}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_96C47962_9842_7692_41E0_EEF5B43E98E4","areas":["this.HotspotPanoramaOverlayArea_96983C64_9841_EE96_41C5_F3060AA95EB1"],"enabledInVR":true},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver0"},"maps":[],"items":[{"pitch":-5.58,"vfov":5.58,"distance":100,"yaw":95.64,"data":{"label":"GoToStateParkRiver0"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":10.5,"image":"this.AnimatedImageResource_8902AA3C_985E_AAF6_41DF_F8413F05D31C","roll":-0.66}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_9625ACE6_9846_EF92_41AE_9C597C7A76BD","areas":["this.HotspotPanoramaOverlayArea_96899AD4_9846_ABB6_41DA_08DC3A586353"],"enabledInVR":true},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver2"},"maps":[],"items":[{"pitch":-5.9,"vfov":5.4,"distance":100,"yaw":-80.04,"data":{"label":"GoToStateParkRiver2"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":6.45,"image":"this.AnimatedImageResource_8902DA3C_985E_AAF6_41C7_BE9AF7247194"}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_962FF70D_9842_7A96_41B1_9AD82EE907FD","areas":["this.HotspotPanoramaOverlayArea_96F28723_9842_7A92_41D4_D807CA432B68"],"enabledInVR":true},{"movements":[{"class":"DistancePanoramaCameraMovement","easing":"cubic_in","yawDelta":18.5,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","yawDelta":323,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","easing":"cubic_out","yawDelta":18.5,"yawSpeed":7.96}],"id":"sequence_92B8DF60_9842_6A8E_41E2_99C3293D3105","class":"PanoramaCameraSequence"},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver2"},"maps":[],"items":[{"pitch":-6.77,"vfov":5.38,"distance":100,"yaw":53.18,"data":{"label":"GoToStateParkRiver2"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":5.72,"image":"this.AnimatedImageResource_89038A3C_985E_AAF6_41B8_31D204EFF993"}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_962A30CD_9842_7797_41D1_FC45CA557F60","areas":["this.HotspotPanoramaOverlayArea_96937853_9842_96B2_41CE_89CDEF406695"],"enabledInVR":true},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver4"},"maps":[],"items":[{"pitch":-5.68,"vfov":5.7,"distance":100,"yaw":-122.18,"data":{"label":"GoToStateParkRiver4"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":7.95,"image":"this.AnimatedImageResource_8903AA3C_985E_AAF6_41DF_559055222E72"}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_9639E961_9842_768E_41E1_80F31C9C0470","areas":["this.HotspotPanoramaOverlayArea_96CDC967_9842_7692_41CA_51FE430FA179"],"enabledInVR":true},{"movements":[{"class":"DistancePanoramaCameraMovement","easing":"cubic_in","yawDelta":18.5,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","yawDelta":323,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","easing":"cubic_out","yawDelta":18.5,"yawSpeed":7.96}],"id":"sequence_92B8BF60_9842_6A8E_41BB_37F3DCA18B6F","class":"PanoramaCameraSequence"},{"movements":[{"class":"DistancePanoramaCameraMovement","easing":"cubic_in","yawDelta":18.5,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","yawDelta":323,"yawSpeed":7.96},{"class":"DistancePanoramaCameraMovement","easing":"cubic_out","yawDelta":18.5,"yawSpeed":7.96}],"id":"sequence_92B85F60_9842_6A8E_41E2_80B19CEA41E5","class":"PanoramaCameraSequence"},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver1"},"maps":[],"items":[{"pitch":-8.03,"vfov":3.91,"distance":100,"yaw":92.13,"data":{"label":"GoToStateParkRiver1"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":6.74,"image":"this.AnimatedImageResource_89021A3C_985E_AAF6_41C2_A70A3F2F4A66"}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_9634770D_9842_7A96_41E1_61991B9D6564","areas":["this.HotspotPanoramaOverlayArea_969C726A_9843_FA92_41DA_D1D73CD7ACB6"],"enabledInVR":true},{"data":{"hasPanoramaAction":true,"label":"GoToStateParkRiver3"},"maps":[],"items":[{"pitch":-5.24,"vfov":5.73,"distance":100,"yaw":-81.94,"data":{"label":"GoToStateParkRiver3"},"scaleMode":"fit_inside","class":"HotspotPanoramaOverlayImage","hfov":10.5,"image":"this.AnimatedImageResource_89024A3C_985E_AAF6_41BD_75CDD3A68F1B"}],"class":"HotspotPanoramaOverlay","useHandCursor":true,"id":"overlay_962CA0CD_9842_7797_41D3_979F6C59E584","areas":["this.HotspotPanoramaOverlayArea_963A20D3_9842_77B3_41DD_870A9E22D49A"],"enabledInVR":true},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_89057A3C_985E_AAF6_417D_3F17707BAB88","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_96AB4D3C_9846_EEF6_4195_805C994B59D2","click":"this.setPlayListSelectedIndex(this.mainPlayList, 1)","class":"HotspotPanoramaOverlayArea"},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_89030A3C_985E_AAF6_41CC_CF10DB5FAE13","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_96983C64_9841_EE96_41C5_F3060AA95EB1","click":"this.setPlayListSelectedIndex(this.mainPlayList, 3)","class":"HotspotPanoramaOverlayArea"},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_8902AA3C_985E_AAF6_41DF_F8413F05D31C","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_96899AD4_9846_ABB6_41DA_08DC3A586353","click":"this.setPlayListSelectedIndex(this.mainPlayList, 0)","class":"HotspotPanoramaOverlayArea"},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_8902DA3C_985E_AAF6_41C7_BE9AF7247194","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_96F28723_9842_7A92_41D4_D807CA432B68","click":"this.setPlayListSelectedIndex(this.mainPlayList, 2)","class":"HotspotPanoramaOverlayArea"},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_89038A3C_985E_AAF6_41B8_31D204EFF993","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_96937853_9842_96B2_41CE_89CDEF406695","click":"this.setPlayListSelectedIndex(this.mainPlayList, 2)","class":"HotspotPanoramaOverlayArea"},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_8903AA3C_985E_AAF6_41DF_559055222E72","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_96CDC967_9842_7692_41CA_51FE430FA179","click":"this.setPlayListSelectedIndex(this.mainPlayList, 4)","class":"HotspotPanoramaOverlayArea"},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_89021A3C_985E_AAF6_41C2_A70A3F2F4A66","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_969C726A_9843_FA92_41DA_D1D73CD7ACB6","click":"this.setPlayListSelectedIndex(this.mainPlayList, 1)","class":"HotspotPanoramaOverlayArea"},{"levels":[{"height":180,"url":"media/res_97FA652D_984E_9E97_41D7_DE0416917053_0.webp","width":330,"class":"ImageResourceLevel"}],"frameCount":9,"rowCount":3,"colCount":3,"class":"AnimatedImageResource","finalFrame":"first","id":"AnimatedImageResource_89024A3C_985E_AAF6_41BD_75CDD3A68F1B","frameDuration":62},{"mapColor":"any","displayTooltipInTouchScreens":true,"id":"HotspotPanoramaOverlayArea_963A20D3_9842_77B3_41DD_870A9E22D49A","click":"this.setPlayListSelectedIndex(this.mainPlayList, 3)","class":"HotspotPanoramaOverlayArea"}],"class":"Player","gap":10,"width":"100%","height":"100%","defaultMenu":["fullscreen","mute","rotation"],"scrollBarMargin":2,"layout":"absolute","propagateClick":false};
if (script['data'] == undefined)
    script['data'] = {};
script['data']['translateObjs'] = translateObjs, script['data']['createQuizConfig'] = function () {
    let a = {}, b = this['get']('data')['translateObjs'];
    for (const c in translateObjs) {
        if (!b['hasOwnProperty'](c))
            b[c] = translateObjs[c];
    }
    return a;
}, TDV['PlayerAPI']['defineScript'](script);
//# sourceMappingURL=script_device.js.map
})();
//Generated with v2026.1.2, Sat Sep 12 2026