import React from 'react';

import BoardFactory from "./Board"

class BoardComponent extends React.Component {

    constructor(props) {
        super(...arguments);
        this.boardConfig = props || {};
        this.props = props;
        this.deleteFile = this._deleteFile.bind(this);
        this.previewPage = this._previewPage.bind(this);
        this.nextPage = this._nextPage.bind(this);
        this.uploadFile = this._uploadFile.bind(this);
        this.changeFile = this._changeBoard.bind(this);
        this.jumpPage = this._jumpPage.bind(this);
        this.state = { attachmentList: [], imageUrl: "", currentPageNum: 0, imageCountList: [], currentAttachmentId: null }
        this.fileSelected = this._fileSelected.bind(this);
    }
    _deleteFile(evt) {
        evt.preventDefault();
        this.boardInstance.deleteAttachment(
            evt.currentTarget.getAttribute("attachmentid"))
            .then(function (data) {
                console.log("删除成功")
            }, function (err) {
                alert(err.message);
            });
    }
    _jumpPage(evt) {
        let pageNum = +evt.currentTarget.value;
        if (!Number.isNaN(pageNum)) {
            this.boardInstance.jumpPage(pageNum - 1);
        }
        this.setState({ currentPageNum: pageNum });
    }
    _changeBoard(evt) {
        evt.preventDefault();
        let attachmentId = evt.currentTarget
            .getAttribute("attachmentid");
        let attachment = this.state.attachmentList.filter(attachment => {
            return attachment.attachmentId == attachmentId;
        })[0];
        let convertProgress = attachment.convertProgress;
        if (convertProgress == "1" || convertProgress == "0") {
            alert("当前文件正在处理中,请稍后刷新页面重试");
            return false;
        } else if (convertProgress == "3") {
            alert("文件转换失败:" + attachment.convertError);
            return false;
        }
        this.boardInstance.changeBoard(evt.currentTarget
            .getAttribute("attachmentid"));
    }
    _previewPage(evt) {
        evt.preventDefault();
        this.boardInstance.previewPage();
    }
    _nextPage(evt) {
        evt.preventDefault();
        this.boardInstance.nextPage();
    }
    _fileSelected(evt) {
        let currentTarget = evt.currentTarget;
        let filesArray = currentTarget.files;
        var files = Array.prototype.slice.call(filesArray);
        if (files.length == 0) {
            var err = new Error("上传文件不能为空");
            return Promise.reject(err);
        } else {
            this.boardInstance.uploadAttachment(filesArray).then(
                function (data) {
                    console.log("上传成功")
                })
        }
    }
    _uploadFile(evt) {
        evt.preventDefault();
        document.querySelector("#uploadFile").click();
    }
    componentDidMount() {
        this.boardInstance = BoardFactory.create(this.boardConfig);
        this.boardInstance.on("board-sync", function (data) {
            let updatePayload = {};
            if (data.data.imageUrl) {
                updatePayload.imageUrl = data.data.imageUrl;
            }
            if (data.data.classroomInfo) {
                let classroomInfo = data.data.classroomInfo;
                updatePayload.attachmentList = [...(data.data.classroomInfo.attachmentList || [])]
                    || [];
                updatePayload.currentPageNum = (+classroomInfo.currentAttachmentPageNum) + 1;
                if (classroomInfo.currentAttachmentId) {
                    updatePayload.currentAttachmentId = classroomInfo.currentAttachmentId;
                    updatePayload.attachmentList.forEach(attachment => {
                        if (attachment.attachmentId == classroomInfo.currentAttachmentId) {
                            let count = +attachment.imageCount;
                            let pageNumList = [];
                            for (let i = 0; i < count; i++) {
                                pageNumList.push(i + 1);
                            }
                            updatePayload.imageCountList = pageNumList;
                            attachment.checked = true;
                        } else {
                            attachment.checked = false;
                        }
                    });
                } else if (updatePayload.attachmentList.length > 0) {
                    Promise.resolve().then(data => {
                        this.boardInstance.changeBoard(updatePayload.attachmentList[0].attachmentId, 0);
                        return data;
                    });
                }
            }
            Promise.resolve(updatePayload).then(data => {
                this.setState(data);
            });
        }.bind(this));
        this.boardInstance.join();
    }
    render() {
        return <div id="imageContainer">
            <div style={{ "display": "inline-block", width: "66%", visibility: !!this.state.imageUrl ? "visible" : "hidden", textAlign: "center" }}>
                <img alt="白板图片" src={this.state.imageUrl} style={{ width: "100%", border: "1px solid gray", borderRadius: "5px" }} />
                <div style={{ "textAlign": "center" }}>
                    <button class="ui primary basic button" style={{ marginRight: "50px" }} onClick={this.previewPage}>上一页</button>
                    <button class="ui primary basic button" style={{ marginRight: "50px" }} onClick={this.nextPage}>下一页</button>
                    <select class="ui  dropdown" value={this.state.currentPageNum} onChange={this.jumpPage}>
                        {this.state.imageCountList.map(i => {
                            return <option value={i + ""}>第{i}页</option>
                        })}
                    </select>
                </div>
            </div >
            <div style={{ "display": "inline-block", width: "30%", float: "right" }}>
                <div className="ui form">
                    <div className="grouped fields">
                        {
                            this.state.attachmentList.map(attachment => {
                                return < div className="field" key={attachment.attachmentId}>
                                    <div className="ui radio checkbox">
                                        <input type="radio" name="attachmentList" checked={attachment.checked} onClick={this.changeFile} attachmentid={attachment.attachmentId} />
                                        <label><span style={{ marginLeft: "10px" }}>{attachment.attachmentName}- {attachment.convertProgress == 0 ? "未处理" : (attachment.convertProgress == 2 ? "已完成" : "正在处理中")} </span> <a href="#"
                                            onClick={this.deleteFile} attachmentid={attachment.attachmentId}>删除</a></label>
                                    </div>
                                </div>
                            })
                        }
                    </div>
                </div>
                <div className="ui horizontal divider">
                    文件管理
                </div>
                <div style={{ textAlign: 'right' }}>
                    <input type="file" id="uploadFile" name="file" style={{ visibility: 'hidden' }} onChange={this.fileSelected} /><button className="ui primary button"
                        onClick={this.uploadFile}>上传文件</button>
                </div >

            </div >


        </div >
    }



}

export default BoardComponent;