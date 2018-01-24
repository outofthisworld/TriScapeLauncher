const ClientUpdater = require('../scripts/updater');
const updateConfig = require('../updateconfig.json');
const { execFile } = require('child_process');

window.onload = function() {
    var plugins, i;
    for (i = 0; i < navigator.plugins.length; ++i) {
        plugins += "<li>" + navigator.plugins.item(i).name + "</li>";
    }

    const display_message = document.getElementById('user_text');
    const play_button = document.getElementById('play_button');

    play_button.style.opacity = 0.3;
    display_message.textContent = 'Checking things are up to date... please wait';

    var progressBar = document.getElementById("myBar");
    var progressBarId;
    var pollStatusQueueId;

    function updateProgressBar() {
        var width = 1;
        return function() {
            if (width >= 100) {
                width = 0;
            } else {
                width++;
                progressBar.style.width = width + '%';
            }
        }
    }

    const statusQueue = [];

    function displayError(err) {
        console.log('display error')
        statusQueue.push(function() {
            progressBar.style.width = '100%';
            progressBar.style.backgroundColor = 'red';
            display_message.textContent = err;
        });
    }

    function displayStatus(status) {
        console.log('display status')
        statusQueue.push(function() {
            display_message.textContent = status;
        });
    }

    function pollStatusQueue() {
        console.log('polliong status queue..')
        if (statusQueue.length)
            (statusQueue.shift())();
    }


    let updater;
    try {
        updater = new ClientUpdater(updateConfig);
    } catch (err) {
        alert(err);
        return;
    }

    updater.on('updated', function launcherReady(resultObj) {
        if (statusQueue.length > 0) {
            setTimeout(function() {
                launcherReady(resultObj)
            }, statusQueue.length * 500);
            return;
        }


        if (resultObj.status === 'Updated') {
            if (resultObj.oldClientVersion) {
                display_message.textContent = `Client version updated from ${resultObj.oldClientVersion} to  ${resultObj.newClientVersion}. Cache updated from ${resultObj.oldCacheVersion} to  ${resultObj.newCacheVersion}. `;
            } else {
                display_message.textContent = `Updated to client version ${resultObj.newClientVersion}.`;
            }

        } else if (resultObj.status === 'UpToDate') {
            display_message.textContent = 'Client is up to date!';
        }


        clearInterval(progressBarId);
        clearInterval(pollStatusQueueId);
        play_button.addEventListener('click', function(event) {
            try {
                execFile('java', ['-jar', resultObj.clientPath], { env: { NODE_LAUNCHER: "true" } }, (error, stdout, stderr) => {
                    if (error) {
                        alert(error)
                    }
                });
            } catch (err) {
                alert(err);
            }
        });
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = 'green';
        play_button.style.opacity = 1;
        play_button.classList.add('play_button');
    })

    updater.on('status', displayStatus);
    updater.on('error', displayError);

    function tryUpdate() {
        progressBarId = setInterval(updateProgressBar(), 10)
        pollStatusQueueId = setInterval(pollStatusQueue, 500);
        console.log('running updater')

        updater.update();
    }

    tryUpdate();
    setInterval(tryUpdate, 60 * 1000 * 60)
}