(function () {
    'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    var DetectionTypes;
    (function (DetectionTypes) {
        DetectionTypes[DetectionTypes["WB"] = 0] = "WB";
        DetectionTypes[DetectionTypes["VJ"] = 1] = "VJ";
        DetectionTypes[DetectionTypes["CS"] = 2] = "CS";
    })(DetectionTypes || (DetectionTypes = {}));
    var Tracker = /** @class */ (function () {
        function Tracker(params) {
            var _this = this;
            this.params = {
                sendEvents: true,
                whitebalancing: true,
                debug: false,
                calcAngles: false,
            };
            this._confidenceThreshold = -10; // needed confidence before switching to Camshift
            this.previousWhitebalances = []; // array of previous 10 whitebalance values
            this.pwbLength = 15;
            this.init = function (inputCanvas) {
                _this._inputcanvas = inputCanvas;
            };
            this.params = __assign({}, params);
            this.currentDetectionType = params.whitebalancing
                ? DetectionTypes.WB
                : DetectionTypes.VJ;
        }
        return Tracker;
    }());

    return Tracker;

}());
