    let apiUrl = "https://api.kickabit.com/team-game/";
    let wsBaseUrl = "wss://socket.kickabit.com/ws";

    if (window.location.hostname === "localhost" || window.location.hostname === "0.0.0.0") {
        apiUrl = "http://localhost:8080/";
        wsBaseUrl = "ws://localhost:8080/ws";
    }

    function refreshTokenLogin(authDetails, onSuccess) {
        fetch(apiUrl + "refresh-token-login", {
            method: "POST",
            body: authDetails.refreshToken
        }).then(function (r) {
            r.json().then(function (data) {
                if (r.status !== 200) {
                    return;
                }
                console.log("Logged in using refresh token");
                localStorage.setItem("authDetails", JSON.stringify(data))
                updateAuthInfoDiv();
                onSuccess();
            });
        });
    }
  function deleteRoom(id) {
    const response = await fetch(apiUrl + "/team-game/rooms/" + id, {
      method: "DELETE",
    });

  }

    function logout() {
        localStorage.removeItem("authDetails")
        document.getElementById("authInfo").hidden = true;
        updateRoomControls();
    }

    function authenticate(onAuthenticated, onGuestUser) {
        let authDetails = getAuthDetails();
        const now = new Date().toISOString();
        const nowPlusMinute = new Date(new Date().getTime() + 60 * 1000).toISOString();

        console.log("auth details: " + authDetails)
        if (authDetails == null) {
            onGuestUser();
            return;
        }

        if (nowPlusMinute > authDetails.idTokenExpirationDate) {
            console.log("id token expired or almost expired")

            if (authDetails.refreshTokenExpirationDate < now) {
                console.log("refresh Token expired")
                onGuestUser();
            } else {
                refreshTokenLogin(authDetails, onAuthenticated);
            }
        } else {
            onAuthenticated()
        }
    }

    function updateAuthInfoDiv() {
        const authInfoDiv = document.getElementById("authInfo");
        const authDisplayName = document.getElementById("authDisplayName");
        authDisplayName.innerHTML = getAuthDetails().displayName
        authInfoDiv.hidden = false;
    }

    function getAuthDetails() {
        return JSON.parse(localStorage.getItem("authDetails"));
    }

    function getRoomId() {
        const roomId = window.location.hash.substring(1);
        if (roomId === "") {
            return null;
        } else {
            return roomId;
        }
    }

    function updateRoomsList() {
        fetch(apiUrl + "rooms", {
            method: "GET",
            headers: {
                "Authorization": "Bearer " + getAuthDetails().idToken
            }
        }).then(function (r) {
            r.json().then(function (data) {
                if (r.status !== 200) {
                    return
                }
                console.log("Retrieved user rooms: " + data.roomIds);

                if (getRoomId() == null) {
                    for (const id of data.roomIds) {
                        document.getElementById("roomsList").innerHTML +=
                            "<a id='join-room-" + id + "' href='#" + id + "'>Join room " + id + "</a><button id='delete-room-" + id + "'>Delete room</button>"
                    }
                }
            });
        });
    }
    function updatePlayerName(playerId, playerName) {
        fetch(apiUrl + "rooms/" + getRoomId() + "/players/" + playerId, {
            method: "PUT",
            body: JSON.stringify({playerName: playerName})
        })
    }

    function updateRoomControls() {
        document.getElementById("roomControls").hidden = getAuthDetails() == null;
    }

    function init() {
        google.accounts.id.initialize({
            client_id: '679464205407-0vt0pvp8of95bbm8vgt6h9q03rfv283o.apps.googleusercontent.com',
            callback: handleCredentialResponse
        });

        authenticate(function () {
            updateAuthInfoDiv();
            updateRoomsList();
        }, function () {
            console.log("missing auth token")
            google.accounts.id.prompt();
        });

        const roomId = getRoomId();

        document.getElementById("roomsList").hidden = false;

        if (roomId == null) {
            console.log("No room selected")
            return
        }

        document.getElementById("roomsList").hidden = true;

        const storedUserJson = localStorage.getItem(roomId);
        let storedUser = JSON.parse(storedUserJson);

        const label = document.getElementById("label");
        const questionElement = document.getElementById("question");

        const playersDiv = document.getElementById("players");
        const messageInput = document.getElementById("message");
        const sendButton = document.getElementById("sendButton");
        const answer = document.getElementById("answer");
        const secondsLeftEl = document.getElementById("secondsLeft");

        messageInput.onkeyup = function (event) {
            if (event.key === "Enter") {
                send();
            }
        }

        document.getElementById("nextQuestionButton").onclick = function () {
            fetch(apiUrl + "rooms/" + roomId + "/set-next-challenge", {
                method: "POST",
                body: JSON.stringify({"secondsCount": 30}),
                headers: {
                    "Authorization": "Bearer " + getAuthDetails().idToken
                }
            }).then(function (r) {
                r.json().then(function () {
                    if (r.status !== 200) {
                        return false;
                    }
                });
            });
        }

        document.getElementById("revealResults").onclick = function () {
            fetch(apiUrl + "rooms/" + roomId + "/reveal-answers", {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + getAuthDetails().idToken
                }
            }).then(function (r) {
                r.json().then(function () {
                    if (r.status !== 200) {
                        return false;
                    }
                });
            });
        }

        setInterval(function () {
            const stopTimestamp = secondsLeftEl.getAttribute("stopTimestamp");
            let secondsLeftValue = Math.round(Number(stopTimestamp) - new Date().getTime() / 1000);
            if (secondsLeftValue <= 0) {
                secondsLeftValue = 0;
            }
            secondsLeftEl.innerHTML = "" + secondsLeftValue;
        }, 1000);

        function addPlayer(player) {
            const row = "<tr>" +
                "<td id='playerCell-" + player + "'>" + player + "</td>" +
                "<td id='playerAnswerTimeCell-" + player + "'>?</td>" +
                "<td id='playerAnswerCell-" + player + "'>?</td>" +
                "<td id='playerScoreCell-" + player + "' hidden>?</td>" +
                "</tr>";

            playersDiv.innerHTML += row;
        }

        function updateChallengeQuestion(id, question, stopTimestamp) {
            questionElement.innerHTML = question
            questionElement.setAttribute("challengeId", id)
            secondsLeftEl.setAttribute("stopTimestamp", stopTimestamp)

            document.getElementById("timeLeftHolder").hidden = false;
        }

        let wsUrl = wsBaseUrl + "?roomId=" + roomId;

        if (storedUser != null) {
            wsUrl = wsUrl + "&playerId=" + storedUser.playerId
            createWebSocket()

            sendButton.onclick = send;
        } else {
            document.getElementById("connectionInfo").hidden = true;

            label.innerHTML = "Enter your name:";
            document.getElementById("controls").hidden = false;
            sendButton.onclick = function () {
                let playerName = messageInput.value;
                wsUrl = wsUrl + "&playerName=" + encodeURIComponent(playerName)

                createWebSocket()
                sendButton.onclick = send;
            }
        }

        function createWebSocket() {
            const socket = new WebSocket(wsUrl);

            socket.onopen = function () {
                console.log("WS opened")
            };

            socket.onclose = function () {
                setTimeout(function () {
                    window.location.reload();
                }, 1000)
            };

            socket.onmessage = function (message) {
                document.getElementById("connectionInfo").hidden = true;
                document.getElementById("header").hidden = false;
                document.getElementById("results").hidden = false;

                if (message.data === "") {
                    return
                }

                const msg = JSON.parse(message.data);
                console.log(msg);

                if (msg.eventType === "PlayerJoined" && localStorage.getItem(roomId) == null) {
                    const user = {
                        playerId: msg.playerId,
                        playerName: msg.playerName
                    };
                    console.log("Received playerId " + msg.playerId)
                    localStorage.setItem(roomId, JSON.stringify(user));
                    storedUser = user;
                }

                function updateName(playerNameSpan, playerNameInput) {
                    return function () {
                        playerNameSpan.hidden = false;
                        if (playerNameSpan.innerHTML !== playerNameInput.value) {
                            playerNameSpan.innerHTML = playerNameInput.value

                            const playerId = JSON.parse(localStorage.getItem(roomId)).playerId
                            updatePlayerName(playerId, playerNameInput.value)
                        }
                        playerNameInput.hidden = true;
                    };
                }

                if (msg.eventType === "PlayerJoined") {
                    let c = msg.currentChallenge;
                    updateChallengeQuestion(c.id, c.question, c.stopTimestamp);
                    document.getElementById("controls").hidden = false;

                    let playerNameSpan = document.getElementById("playerName");
                    let playerNameInput = document.getElementById("playerNameInput");

                    playerNameSpan.innerHTML = msg.playerName;

                    playerNameSpan.onmouseover = function () {
                        playerNameSpan.hidden = true;
                        playerNameInput.value = playerNameSpan.innerText
                        playerNameInput.hidden = false;
                    }

                    playerNameInput.onkeyup = function (event) {
                        if (event.key === "Enter") {
                            updateName(playerNameSpan, playerNameInput)
                        }
                    }

                    playerNameInput.onmouseleave = updateName(playerNameSpan, playerNameInput)

                    for (const player of msg.players) {
                        addPlayer(player);
                    }

                    label.innerHTML = "Your answer: ";
                    updateRoomControls();
                }

                if (msg.eventType === "OtherPlayerJoined") {
                    if (document.getElementById("playerCell-" + msg.playerName) == null) {
                        addPlayer(msg.playerName);
                    }
                }

                if (msg.eventType === "PlayerAnswered") {
                    document.getElementById("playerAnswerCell-" + msg.playerName).innerHTML = "•";
                }

                if (msg.eventType === "CurrentChallengeUpdated") {
                    updateChallengeQuestion(msg.currentChallenge.challengeId, msg.question, msg.currentChallenge.stopTimestamp);
                }

                if (msg.eventType === "ResultTablePublished") {
                    for (it of msg.answers) {
                        if (document.getElementById("playerCell-" + it.playerName) != null) {
                            document.getElementById("playerAnswerTimeCell-" + it.playerName).innerHTML = it.seconds;
                            document.getElementById("playerAnswerCell-" + it.playerName).innerHTML = it.answer;
                            document.getElementById("playerScoreCell-" + it.playerName).innerHTML = it.score;
                            document.getElementById("playerScoreCell-" + it.playerName).hidden = false;
                            document.getElementById("scoreTableHeader").hidden = false;
                        }
                    }
                }

                if (msg.eventType === "PlayerNameUpdated") {
                    let playerCell = document.getElementById("playerCell-" + msg.oldName);
                    if (playerCell != null) {
                        playerCell.innerHTML = msg.newName
                        playerCell.id = "playerCell-" + msg.newName
                        document.getElementById("playerAnswerTimeCell-" + msg.oldName).id = "playerAnswerTimeCell-" + msg.newName
                        document.getElementById("playerAnswerCell-" + msg.oldName).id = "playerAnswerCell-" + msg.newName;
                        document.getElementById("playerScoreCell-" + msg.oldName).id = "playerScoreCell-" + msg.newName;
                    }
                }
            };
        }

        function send() {
            const inputValue = messageInput.value;

            if (inputValue !== "") {
                fetch(apiUrl + "rooms/" + roomId + "/answers", {
                    method: "POST",
                    body: JSON.stringify({
                        playerId: storedUser.playerId,
                        answer: inputValue,
                        challengeId: questionElement.getAttribute("challengeId")
                    })
                }).then(function (r) {
                    if (r.ok) {
                        answer.innerHTML = "Your answer: " + inputValue;

                        console.log("Answer sent!")
                    }
                })

                messageInput.value = "";
            } else {
                alert("You must enter a message to be sent!");
            }
        }
    }

    function parseJwt (token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload);
    }

    function handleCredentialResponse(resp) {
        console.log(parseJwt(resp.credential));
        document.getElementById("authInfo").hidden = false;

        fetch(apiUrl + "google-login", {
            method: "POST",
            body: resp.credential
        }).then(function (r) {
            r.json().then(function (data) {
                if (r.status !== 200) {
                    return;
                }
                console.log(data);
                localStorage.setItem("authDetails", JSON.stringify(data));
                updateAuthInfoDiv();
                updateRoomsList();
                if (getRoomId() != null) {
                    updateRoomControls();
                }
            });
        });
    }

    window.onhashchange = function () {
        window.location.reload();
    }

    window.onload = init;
