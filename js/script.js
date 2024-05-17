let apiUrl = "https://api.kickabit.com/";
let wsBaseUrl = "wss://socket.kickabit.com/ws";

if (window.location.hostname === "localhost" || window.location.hostname === "0.0.0.0") {
    apiUrl = "http://localhost:8080/";
    wsBaseUrl = "ws://localhost:8080/ws";
}

async function refreshTokenLogin(authDetails, onSuccess) {
    let response = await fetch(apiUrl + "refresh-token-login", {
        method: "POST",
        body: authDetails.refreshToken
    })
    let body = await response.json()
    
    if (!response.ok) {
        console.log(response)
        alert("login failed")
        return;
    }
    console.log("Logged in using refresh token");
    localStorage.setItem("authDetails", JSON.stringify(body))
    updateAuthInfoDiv();
    onSuccess();
}

async function deleteRoom(id) {
    const response = await fetch(apiUrl + "rooms/" + id, {
        method: "DELETE",
        headers: {
            "Authorization": "Bearer " + getAuthDetails().idToken
        }
    });
    
    if (!response.ok) {
        alert("Could not delete room")
    }
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

async function updateRoomsList() {
    let response = await fetch(apiUrl + "rooms", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + getAuthDetails().idToken
        }
    })
    
    if (!response.ok) {
        return
    }
    
    let body = await response.json()
    console.log("Retrieved user rooms: " + body.rooms);

    if (getRoomId() == null) {
        document.getElementById("roomsList").innerHTML = ""
        for (const room of body.rooms) {
            document.getElementById("roomsList").innerHTML +=
                "<div><a id='join-room-" + room.roomId + "' href='#" + room.roomId + "'>" + room.name + "</a><button id='delete-room-" + room.roomId + "'>X</button></div>";
        }
        for (const room of body.rooms) {
            document.getElementById("delete-room-" + room.roomId).onclick = async function () {
                await deleteRoom(room.roomId)
                await updateRoomsList()
            }
        }
    }
}

async function updatePlayerName(playerId, playerName) {
    let response = await fetch(apiUrl + "rooms/" + getRoomId() + "/players/" + playerId, {
        method: "PUT",
        body: JSON.stringify({playerName: playerName})
    })
    
    if (!response.ok) {
        alert("Could not update player name")
    }
}

function updateRoomControls() {
    document.getElementById("roomControls").hidden = getAuthDetails() == null;
}

function init() {
    google.accounts.id.initialize({
        client_id: '679464205407-0vt0pvp8of95bbm8vgt6h9q03rfv283o.apps.googleusercontent.com',
        callback: handleCredentialResponse
    });

    const textbox = document.querySelector("#newRoomName");
    document.getElementById("createNewRoom").onclick = async function() {
        await createRoom(textbox.value);
        await updateRoomsList()
        textbox.value = ""
    }

    authenticate(function () {
        updateAuthInfoDiv();
        updateRoomsList();
        document.getElementById("loginForm").hidden = true
    }, function () {
        console.log("missing auth token")
        google.accounts.id.prompt();
        document.getElementById("loginForm").hidden = false
    });

    document.getElementById("loginButton").onclick = async function () {
        let response = await fetch(apiUrl + "login", {
            method: "POST",
            body: JSON.stringify({
                username: document.getElementById("usernameInput").value,
                password: document.getElementById("passwordInput").value
            })
        })
        if (!response.ok) {
            alert("Could not login")
            return
        }
        let value = await response.text();
        localStorage.setItem("authDetails", value)
        updateAuthInfoDiv()
        updateRoomsList()
        document.getElementById("roomCreation").hidden = false
        document.getElementById("loginForm").hidden = true
    }
    

    const roomId = getRoomId();

    document.getElementById("roomsList").hidden = false;

    if (roomId == null) {
        console.log("No room selected")
        if (getAuthDetails() != null) {
            document.getElementById("roomCreation").hidden = false
        }
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

    messageInput.onkeyup = async function (event) {
        if (event.key === "Enter") {
            await submitAnswer();
        }
    }

    document.getElementById("nextQuestionButton").onclick = async function () {
        let response = await fetch(apiUrl + "rooms/" + roomId + "/set-next-challenge", {
            method: "POST",
            body: JSON.stringify({"secondsCount": 30}),
            headers: {
                "Authorization": "Bearer " + getAuthDetails().idToken
            }
        })
        
        if (!response.ok) {
            alert("Could not post next question")
        }
    }

    document.getElementById("revealResults").onclick = async function () {
        let response = await fetch(apiUrl + "rooms/" + roomId + "/reveal-answers", {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + getAuthDetails().idToken
            }
        })

        if (!response.ok) {
            alert("Could not revealResults")
        }
    }

    function updateTimeLeft() {
        const stopTimestamp = secondsLeftEl.getAttribute("stopTimestamp");
        let secondsLeftValue = Math.round(Number(stopTimestamp) - new Date().getTime() / 1000);
        if (secondsLeftValue <= 0) {
            secondsLeftValue = 0;
        }
        secondsLeftEl.innerHTML = "" + secondsLeftValue + " ";

        if (secondsLeftValue === 0) {
            document.getElementById("answerPostingForm").hidden = true
        }
    }

    function addPlayer(player) {
        let removePlayerButtonHtml = "<button id='removePlayer-" + player + "'>x</button>"
        if (getAuthDetails() == null) {
            removePlayerButtonHtml = ""
        }
        const row = "<tr>" +
            "<td id='playerCell-" + player + "'>" + player + removePlayerButtonHtml + "</td>" +
            "<td id='playerAnswerTimeCell-" + player + "' class='playerAnswerTimeClass'>?</td>" +
            "<td id='playerAnswerCell-" + player + "' class='playerAnswerClass'>?</td>" +
            "<td id='playerScoreCell-" + player + "' class='playerScoreClass' hidden>?</td>" +
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

    console.log("Stored user: " + storedUser)

    function joinRoom() {
        let playerName = document.getElementById("roomJoiningTextInput").value;
        if (playerName.trim() === "" || playerName.indexOf("/") > 0 
            || playerName.indexOf("<") > 0 || playerName.indexOf(">") > 0) {
            alert("Incorrect name")
            return
        }
        createWebSocket(wsUrl + "&playerName=" + encodeURIComponent(playerName))
    }

    document.getElementById("roomJoiningTextInput").onkeyup = function(e) {
        if (e.key === "Enter") {
            joinRoom()
        }
    }
    
    if (storedUser != null) {
        createWebSocket(wsUrl + "&playerId=" + storedUser.playerId)
    } else {
        document.getElementById("connectionInfo").hidden = true;
        document.getElementById("answerPostingForm").hidden = true;
        document.getElementById("roomJoiningForm").hidden = false;
        document.getElementById("joinRoomButton").onclick = joinRoom
    }

    function createWebSocket(url) {
        const socket = new WebSocket(url);

        console.log("Creating websocket " + url)
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
                    let value = playerNameInput.value.trim();
                    if (value === "") {
                        alert("Name cannot be empty")
                    }
                    value = value.replace("/", "")
                    value = value.replace("\"", "")

                    if (playerNameSpan.innerHTML !== value) {
                        playerNameSpan.innerHTML = value

                        const playerId = JSON.parse(localStorage.getItem(roomId)).playerId
                        updatePlayerName(playerId, value)
                    }
                    playerNameInput.hidden = true;
                };
            }

            if (msg.eventType === "PlayerJoined") {
                let c = msg.currentChallenge;
                updateChallengeQuestion(c.id, c.question, c.stopTimestamp);
                document.getElementById("answerPostingForm").hidden = false;
                document.getElementById("roomJoiningForm").hidden = true;

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

                for (const player of msg.players) {
                    if (getAuthDetails() != null) {
                        document.getElementById("removePlayer-" + player).onclick = async function () {
                            let response = await fetch(apiUrl + "rooms/" + roomId + "/player-names/" + player, {
                                method: "DELETE",
                                headers: {
                                    "Authorization": getAuthDetails().idToken
                                }
                            })
                            if (!response.ok) {
                                console.log(response)

                                alert("Could not remove user")
                            }
                        }
                    }
                }

                label.innerHTML = "Your answer: ";
                updateRoomControls();
                updateTimeLeft();
                setInterval(updateTimeLeft, 1000);
                document.getElementById("submitAnswerButton").onclick = submitAnswer;
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
                document.getElementById("message").value = ""
                document.getElementById("answer").innerHTML = ""
                document.getElementById("answerPostingForm").hidden = false
                document.getElementById("correctAnswerHolder").hidden = true

                for (let el of document.getElementsByClassName("playerAnswerClass")) {
                    el.innerHTML = "?"
                }

                for (let el of document.getElementsByClassName("playerScoreClass")) {
                    el.innerHTML = "?"
                }
                for (let el of document.getElementsByClassName("playerAnswerTimeClass")) {
                    el.innerHTML = "?"
                }
            }

            if (msg.eventType === "ResultTablePublished") {
                document.getElementById("answerPostingForm").hidden = true
                document.getElementById("timeLeftHolder").hidden = true
                document.getElementById("correctAnswerHolder").hidden = false
                document.getElementById("correctAnswerSpan").innerHTML = msg.correctAnswer

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

    async function submitAnswer() {
        const inputValue = messageInput.value;

        if (inputValue !== "") {
            let response = await fetch(apiUrl + "rooms/" + roomId + "/answers", {
                method: "POST",
                body: JSON.stringify({
                    playerId: storedUser.playerId,
                    answer: inputValue,
                    challengeId: questionElement.getAttribute("challengeId")
                })
            })
            if (response.ok) {
                answer.innerHTML = "Your answer: " + inputValue;
            }

            messageInput.value = "";
        } else {
            alert("You must enter a message to be sent!");
        }
    }
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

async function createRoom(name) {
    let response = await fetch(apiUrl + "rooms", {
        method: "POST",
        body: JSON.stringify({
            "name": name,
        }),
        headers: {
            "Authorization": getAuthDetails().idToken
        }
    });
    if (!response.ok) {
        alert("Could not create room")
    }
    console.log(response.status)
}


async function handleCredentialResponse(resp) {
    console.log(parseJwt(resp.credential));
    document.getElementById("authInfo").hidden = false;

    let response = await fetch(apiUrl + "google-login", {
        method: "POST",
        body: resp.credential
    })
        
    let body = await response.json()
    if (response.ok) {
        return;
    }
    localStorage.setItem("authDetails", JSON.stringify(body));
    updateAuthInfoDiv();
    updateRoomsList();
    if (getRoomId() != null) {
        updateRoomControls();
    } else {
        document.getElementById("roomCreation").hidden = false;
    }
}

window.onhashchange = function () {
    window.location.reload();
}

window.onload = init;
