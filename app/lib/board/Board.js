var assertNotNullable = function (val, msg) {
    if (!val) {
        throw new Error(msg);
    }
}
let Board = function (config) {
    var classroomId = config.classroomId;
    var userId = config.userId;
    var boardServer = config.boardServer || "https://e.yuge.com";
    assertNotNullable(classroomId, "classroomId不能为空");
    assertNotNullable(userId, "userId不能为空");
    if (boardServer.endsWith("/")) {
        boardServer = boardServer.substring(0, boardServer.length - 1);
    }
    var url = new URL(boardServer);
    var boardWSServer = "";
    if (url.protocol == "https:") {
        boardWSServer = "wss://" + url.host;
    } else {
        boardWSServer = "ws://" + url.host;
    }

    this.config = {
        classroomId: classroomId,
        userId: userId,
        boardServer: boardServer,
        boardWSServer: boardWSServer,
        wsUrl: boardWSServer + "/yboard/sync/" + classroomId

    };

    Object.assign(this.config, {

        loadImageUrlPrefix: this.url("yboard/auth/res"),

        deleteAttachmentUrl: this
            .url("yboard/authorize/attachment/deleteAttachment"),
        addAttachmentUrl: this
            .url("yboard/authorize/attachment/addAttachment"),
        queryAttachmentListUrl: this
            .url("yboard/authorize/attachment/queryAttachmentList"),
        queryAttachmentDetailUrl: this
            .url("yboard/authorize/attachment/queryAttachmentDetail"),
        syncUrl: this.url("yboard/authorize/classroom/sync"),

    });

    this.listeners = {};

    Object.freeze(this.config);

};

// board mixin
Object
    .assign(
        Board.prototype,
        {

            url: function (path) {
                return [this.config.boardServer, path].join("/");
            },

            __keepalive: function () {
                var keepaliveFlag = setInterval(
                    function () {
                        if (!this.forceClose
                            && this.boardConnection
                            && this.boardConnection.readyState == 1) {
                            this.boardConnection.send(JSON
                                .stringify({
                                    eventType: "ping"
                                }));

                        } else if (this.forceClose) {
                            clearInterval(keepaliveFlag);
                        }
                    }, 15000);

            },

            join: function () {
                this.__keepalive();
                return this.join0();

            },

            __computeSyncEvent: function (forceEmit) {
                if (this.classroomInfo.currentAttachmentId) {
                    var attachmentId = this.classroomInfo.currentAttachmentId;
                    var pageNum = +this.classroomInfo.currentAttachmentPageNum;
                    var attachmentInfo = this.classroomInfo.attachmentList
                        .filter(function (att) {
                            return att.attachmentId == attachmentId
                        })[0];
                    if (attachmentInfo.imageCount) {

                        var imageName = pageNum + "";

                        while (imageName.length < 4) {
                            imageName = "0" + imageName;
                        }
                        imageName = imageName + "."
                            + attachmentInfo.imageFormat;

                        var prefix = this.config.loadImageUrlPrefix;

                        var url = [prefix, attachmentId, imageName]
                            .join("/")
                        var data = {
                            attachmentId: attachmentId,
                            pageNum: pageNum,
                            imageUrl: url,
                            classroomInfo: JSON.parse(JSON
                                .stringify(this.classroomInfo))
                        };
                        this.emit("board-sync", data);
                    } else {
                        var data = {
                            classroomInfo: JSON.parse(JSON
                                .stringify(this.classroomInfo))
                        };
                        this.emit("board-sync", data);
                    }

                } else if (forceEmit) {
                    var data = {
                        classroomInfo: JSON.parse(JSON
                            .stringify(this.classroomInfo))
                    };
                    this.emit("board-sync", data);
                }
            },

            __syncClassroomInfo: function (classroomInfo) {

                this.classroomInfo = classroomInfo;
                this.__computeSyncEvent(true)

                // if (!this.classroomInfo) {
                // this.classroomInfo = classroomInfo;
                // this.__computeSyncEvent(true);
                // } else {
                // var _oldClassroomInfo = this.classroomInfo;
                // this.classroomInfo = classroomInfo;
                // if (_oldClassroomInfo.currentAttachmentId !=
                // classroomInfo.currentAttachmentId
                // || _oldClassroomInfo.currentAttachmentPageNum !=
                // classroomInfo.currentAttachmentPageNum) {
                // this.__computeSyncEvent();
                // }
                // }

            },

            join0: function () {

                var resolveFunc, rejectFunc;

                var promise = new Promise(
                    function (resolve, reject) {
                        resolveFunc = resolve;
                        rejectFunc = reject;
                    });

                this.boardConnection = new WebSocket(
                    this.config.wsUrl);

                this.boardConnection.onerror = function (error) {
                    console.error("connect to " + this.config.wsUrl
                        + " error:" + error.message);
                }.bind(this);

                this.boardConnection.onopen = function () {
                    this.boardConnection.send(JSON.stringify({
                        eventType: "join",
                        userId: this.config.userId,
                        classroomId: this.config.classroomId
                    }));
                }.bind(this);

                this.boardConnection.onclose = function () {
                    if (!this.forceClose) {
                        setTimeout(this.join0.bind(this), 1000);
                    }
                }.bind(this);

                this.boardConnection.onmessage = function (event) {
                    var data = JSON.parse(event.data);
                    var eventType = data.eventType;
                    if (eventType == "join-ack") {
                        this.__syncClassroomInfo(data.data);
                        resolveFunc(data.data);
                    } else if (eventType == "join-error") {
                        rejectFunc(new Error(data.error));
                    } else if (eventType == "change-board-error") {
                        console.warn("change-board-error:"
                            + event.data);
                    } else if (eventType == "board-sync") {
                        this.__syncBoard(data);
                    } else if (eventType == "sync") {
                        this.sync();
                    } else if (eventType == "sync-all-error") {
                        console
                            .warn("sync-all-error:"
                                + event.data);
                    } else {
                        console.warn("can't handle eventType "
                            + eventType + " with data "
                            + event.data);
                    }

                }.bind(this);

                return promise;

            },

            __syncBoard: function (syncData) {
                if (this.classroomInfo == null) {
                    this.sync();
                } else {
                    var attachmentInfo = this
                        .findAttachment(syncData.attachmentId);
                    if (attachmentInfo == null
                        || !attachmentInfo.imageCount) {
                        this.sync();
                    } else {
                        var updateInfo = JSON.parse(JSON
                            .stringify(this.classroomInfo));
                        updateInfo.currentAttachmentId = syncData.attachmentId;
                        updateInfo.currentAttachmentPageNum = syncData.pageNum;
                        this.__syncClassroomInfo(updateInfo);
                    }

                }

            },

            __request: function (url, data) {
                var params = {};
                Object.assign(params, data, {
                    "X-Authorize-Userid": this.config.userId,
                    "X-Authorize-Appid": this.config.appId,
                    "X-Authorize-Code": this.config.authKey
                });
                var body = Object
                    .keys(params)
                    .map(
                        function (key) {
                            return key
                                + "="
                                + encodeURIComponent(params[key])
                        }).join("&");
                var contentType = 'application/x-www-form-urlencoded';
                return fetch(url, {
                    method: 'POST',
                    mode: 'no-cors',
                    cache: 'no-cache',
                    credentials: 'include',
                    headers: {
                        'Content-Type': contentType
                    },
                    body: body
                }).then(
                    function (response) {
                        if (response.status != 200) {
                            console.warn("request url:" + url
                                + " error: http status "
                                + response.status);
                            throw new Error(
                                "请求失败: http status "
                                + response.status);
                        } else {
                            return response.json();
                        }
                    }).then(
                        function (data) {
                            if (data.resultCode != 0) {
                                console.warn("request url:" + url
                                    + " error: cause "
                                    + data.cause);
                                throw new Error(
                                    "请求失败: http status "
                                    + data.cause);
                            } else {
                                return data.data;
                            }
                        });
            },

            __upload: function (url, data) {
                var fd = new FormData()
                fd.append('classroomId', this.config.classroomId)
                if (data.length != null) {
                    var files = Array.prototype.slice.call(data);
                    if (files.length == 0) {
                        var err = new Error("上传文件不能为空");
                        return Promise.reject(err);

                    }
                    var notFiles = files
                        .filter(function (file, idx) {
                            if (Object.prototype.toString.call(
                                file).indexOf("File") == -1) {
                                return true;
                            }
                            fd.append("file" + (idx), file);
                            return false;
                        });
                    if (notFiles.length) {
                        var err = new Error("data is not files");
                        return Promise.reject(err);
                    }
                } else {
                    if (Object.prototype.toString.call(data)
                        .indexOf("File") == -1) {
                        var err = new Error("data is not file");
                        return Promise.reject(err);
                    }
                    fd.append("file", data);
                }
                var params = {};
                Object.assign(params, data, {
                    "X-Authorize-Userid": this.config.userId,
                    "X-Authorize-Appid": this.config.appId,
                    "X-Authorize-Code": this.config.authKey
                });
                var body = Object
                    .keys(params)
                    .map(
                        function (key) {
                            return key
                                + "="
                                + encodeURIComponent(params[key])
                        }).join("&");
                // var contentType = 'multipart/form-data';
                url = url.indexOf("?") == -1 ? (url + "?" + body)
                    : (url + body);

                return fetch(url, {
                    method: 'POST',
                    mode: 'no-cors',
                    cache: 'no-cache',
                    credentials: 'include',
                    body: fd
                }).then(
                    function (response) {
                        if (response.status != 200) {
                            console.warn("request url:" + url
                                + " error: http status "
                                + response.status);
                            throw new Error(
                                "请求失败: http status "
                                + response.status);
                        } else {
                            return response.json();
                        }
                    }).then(
                        function (data) {
                            if (data.resultCode != 0) {
                                console.warn("request url:" + url
                                    + " error: cause "
                                    + data.cause);
                                throw new Error(
                                    "请求失败: http status "
                                    + data.cause);
                            } else {
                                return data.data;
                            }
                        });
            },

            uploadAttachment: function (data) {
                var promise = this.__upload(
                    this.config.addAttachmentUrl, data);
                return promise.then(function (data) {
                    return this.sync()
                }.bind(this))["catch"](function (err) {
                    throw new Error("上传或同步失败:" + err.message)

                });
            },

            uploadAttachment: function (data) {
                var promise = this.__upload(
                    this.config.addAttachmentUrl, data);
                return promise.then(function (data) {
                    return this.sync()
                }.bind(this))["catch"](function (err) {
                    throw new Error("上传或同步失败:" + err.message)

                });
            },

            deleteAttachment: function (attachmentId) {
                var attachmentInfo = this
                    .findAttachment(attachmentId);

                if (attachmentInfo == null) {
                    return Promise.reject(new Error("删除的文件不存在"));
                }

                if (this.classroomInfo.currentAttachmentId == attachmentId) {
                    return Promise.reject(new Error("不能删除当前选中的文件"));
                }

                var params = {
                    classroomId: this.config.classroomId,
                    attachmentIdList: [attachmentId]
                };

                return this.__request(
                    this.config.deleteAttachmentUrl, {
                    data: JSON.stringify(params)
                }).then(function (data) {
                    this.sendSyncMessage("sync-all", {
                        appId: this.config.appId,
                        userId: this.config.userId,
                        classroomId: this.config.classroomId
                    });
                    return data;
                }.bind(this))["catch"](function (err) {
                    throw new Error("删除文件失败：" + err.message);
                });

            },

            sendSyncMessage: function (eventType, data) {
                var eventData = {};
                Object.assign(eventData, {
                    eventType: eventType
                }, data);
                if (!this.forceClose && this.boardConnection
                    && this.boardConnection.readyState == 1) {
                    this.boardConnection.send(JSON
                        .stringify(eventData));

                } else {
                    alert("当前连接不可用");
                }

            },

            sync: function () {
                return this.__request(this.config.syncUrl, {
                    data: JSON.stringify({
                        classroomId: this.config.classroomId
                    })
                }).then(function (data) {
                    this.__syncClassroomInfo(data);
                    return data;
                }.bind(this))["catch"](function (err) {
                    alert("请求失败:" + err.message);
                });
            },
            changeBoard: function (attachmentId, pageNum) {
                var attachmentInfo = this
                    .findAttachment(attachmentId);
                if (attachmentInfo && attachmentInfo.imageCount) {
                    if (pageNum != null
                        && +pageNum >= +attachmentInfo.imageCount) {
                        console.warn("pageNum exceed max pageNum "
                            + (+attachmentInfo.imageCount - 1))

                        return;

                    }
                }
                this.sendSyncMessage("change-board", {
                    appId: this.config.appId,
                    userId: this.config.userId,
                    classroomId: this.config.classroomId,
                    attachmentId: attachmentId.toString(),
                    pageNum: pageNum == null ? null : pageNum
                        .toString()
                });
            },
            nextPage: function () {
                if (this.classroomInfo
                    && this.classroomInfo.currentAttachmentId) {
                    var attachmentId = this.classroomInfo.currentAttachmentId;
                    var pageNum = this.classroomInfo.currentAttachmentPageNum;
                    var attachmentInfo = this
                        .findAttachment(attachmentId);
                    var nextPageNum = (+pageNum) + 1;
                    if (nextPageNum >= attachmentInfo.imageCount) {
                        return;
                    } else {
                        this.changeBoard(attachmentId, nextPageNum);
                    }
                } else {
                    alert("当前没有可用的白板");
                }

            },

            previewPage: function () {
                if (this.classroomInfo
                    && this.classroomInfo.currentAttachmentId) {
                    var attachmentId = this.classroomInfo.currentAttachmentId;
                    var pageNum = this.classroomInfo.currentAttachmentPageNum;
                    var attachmentInfo = this
                        .findAttachment(attachmentId);
                    var nextPageNum = (+pageNum) - 1;
                    if (nextPageNum < 0) {
                        return;
                    } else {
                        this.changeBoard(attachmentId, nextPageNum);
                    }
                } else {
                    alert("当前没有可用的白板");
                }
            },

            jumpPage: function (pageNum) {
                if (this.classroomInfo
                    && this.classroomInfo.currentAttachmentId) {
                    var attachmentId = this.classroomInfo.currentAttachmentId;
                    var jumpPageNum = +pageNum;
                    if (jumpPageNum < 0) {
                        return;
                    } else {
                        this.changeBoard(attachmentId, jumpPageNum);
                    }
                } else {
                    alert("当前没有可用的白板");
                }
            },

            attachmentList: function () {
                return (this.classroomInfo && this.classroomInfo.attachmentList)
                    || [];
            },
            findAttachment: function (attachmentId) {
                return this.attachmentList().filter(function (att) {
                    return att.attachmentId == attachmentId;
                })[0];
            },

            on: function (evt, listener) {
                assertNotNullable(evt, "evt不能为空");
                assertNotNullable(listener, "listener不能为空");
                var listeners = this.listeners[evt] = this.listeners[evt]
                    || [];
                this.listeners[evt].push(listener);
                return function () {
                    var index = listeners.findIndex(function (v) {
                        v == listener
                    });
                    if (index != -1) {
                        listeners.splice(index, 1);
                    }
                };
            },
            emit: function (evt, data) {
                assertNotNullable(evt, "evt不能为空");
                assertNotNullable(data, "data不能为空");
                var event = {
                    event: evt,
                    data: data
                };
                (this.listeners[evt] || []).forEach(function (cb) {
                    cb.call(this, event);
                }.bind(this));
            },
            close: function () {
                if (!this.forceClose && this.boardConnection
                    && this.boardConnection.readyState == 1) {
                    this.forceClose = true;
                    this.boardConnection.close();
                }
            }

        });

// board factory
export default {
    create: function (config) {
        return new Board(config);
    }

}
