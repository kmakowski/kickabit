let apiUrl = "https://api.kickabit.com/";
let wsBaseUrl = "wss://socket.kickabit.com/ws";

if (window.location.hostname === "localhost" || window.location.hostname === "0.0.0.0") {
    apiUrl = "http://localhost:8080/";
    wsBaseUrl = "ws://localhost:8080/ws";
}

function getAuthDetails() {
    return JSON.parse(localStorage.getItem("authDetails"));
}
function saveAuthDetails(authDetailsAsString) {
    localStorage.setItem("authDetails", authDetailsAsString);
}
function getIdToken() {
    return getAuthDetails().idToken
}

function defaultHeaders() {
    return {
        "Authorization": "Bearer " + getIdToken()
    };
}
let notifyApiCallError = function (errorMsg) {
    console.error("Error while calling API: " + errorMsg)
}

async function loginUsingRefreshToken() {
    let response = await fetch(apiUrl + "refresh-token-login", {
        method: "POST",
        body: getAuthDetails().refreshToken
    })

    if (!response.ok) {
        notifyApiCallError("Could not get refresh token")
        return null
    }
    let body = await response.text()

    saveAuthDetails(body)

    return true
}
async function loginUsingGoogleCredential(credential) {
    let response = await fetch(apiUrl + "google-login", {
        method: "POST",
        body: credential
    })

    let body = await response.text()
    if (!response.ok) {
        notifyApiCallError("Could not sign in with google")
        return false;
    }
    saveAuthDetails(body);

    return true
}

async function deleteRoom(roomId) {
    const response = await fetch(apiUrl + "rooms/" + roomId, {
        method: "DELETE",
        headers: defaultHeaders()
    });

    if (!response.ok) {
        notifyApiCallError("Could not delete room")
        return false
    }
    
    return true
}

async function updatePlayerName(playerId, playerName) {
    let response = await fetch(apiUrl + "rooms/" + getRoomId() + "/players/" + playerId, {
        method: "PUT",
        body: JSON.stringify({playerName: playerName})
    })

    if (!response.ok) {
        notifyApiCallError("Could not update player name")
        return false
    }
    
    return true
}


async function usernamePasswordLogin(username, password) {
    let response = await fetch(apiUrl + "login", {
        method: "POST",
        body: JSON.stringify({
            username: document.getElementById("usernameInput").value,
            password: document.getElementById("passwordInput").value
        })
    })
    if (!response.ok) {
        notifyApiCallError("Could not login")
        return false
    }
    let value = await response.text();
    saveAuthDetails(value);
    return true
}

async function getRoomsList() {
    let response = await fetch(apiUrl + "rooms", {
        method: "GET",
        headers: defaultHeaders()
    })

    if (!response.ok) {
        notifyApiCallError("Could not get rooms")
        return null
    }

    return await response.json()
}

async function createRoom(name) {
    let response = await fetch(apiUrl + "rooms", {
        method: "POST",
        body: JSON.stringify({
            "name": name,
        }),
        headers: defaultHeaders()
    });
    if (!response.ok) {
        notifyApiCallError("Could not create room")
        return false
    }
    return true
}

async function createGame(name) {
    let response = await fetch(apiUrl + "games", {
        method: "POST",
        body: JSON.stringify({
            "name": name,
        }),
        headers: defaultHeaders()
    });
    if (!response.ok) {
        notifyApiCallError("Could not create game")
        return false
    }
    return true
}

async function deleteGame(gameId) {
    const response = await fetch(apiUrl + "games/" + gameId, {
        method: "DELETE",
        headers: defaultHeaders()
    });

    if (!response.ok) {
        notifyApiCallError("Could not delete game")
        return false
    }
    
    return true
}

async function getGamesList() {
  let response = await fetch(apiUrl + "games", {
    method: "GET",
    /* body: JSON.stringify({
      "name": name,
    }),
    */
    headers: defaultHeaders()
  });
  if (!response.ok){
    notifyApiCallError("Could not create room")
    return null
  }
  return await response.json();
}

async function publishNextQuestion(roomId, secondsCount) {
    let response = await fetch(apiUrl + "rooms/" + roomId + "/set-next-challenge", {
        method: "POST",
        body: JSON.stringify({"secondsCount": secondsCount}),
        headers: defaultHeaders()
    })
    if (!response.ok) {
        notifyApiCallError("Could not post next question")
        return false
    }
    
    return true
}

async function giveExtraTime(roomId, secondsCount) {
    let response = await fetch(apiUrl + "rooms/" + roomId + "/current-challenge", {
        method: "PUT",
        body: JSON.stringify({"secondsCount": secondsCount}),
        headers: defaultHeaders()
    })

    if (!response.ok) {
        notifyApiCallError("Could not give extra time")
        return false
    }
    
    return true
}

async function revealAnswers(roomId) {
    let response = await fetch(apiUrl + "rooms/" + roomId + "/reveal-answers", {
        method: "POST",
        headers: defaultHeaders()
    })
    if (!response.ok) {
        notifyApiCallError("Could not revealResults")
        return false
    }
    
    return true
}

async function removePlayer(player) {
    let response = await fetch(apiUrl + "rooms/" + roomId + "/player-names/" + player, {
        method: "DELETE",
        headers: defaultHeaders()
    })
    if (!response.ok) {
        notifyApiCallError("Could not remove user")
        return false
    }
    return true
}

async function apiSubmitAnswer(roomId, playerId, challengeId, answer) {
    let response = await fetch(apiUrl + "rooms/" + roomId + "/answers", {
        method: "POST",
        body: JSON.stringify({
            playerId: playerId,
            challengeId: challengeId,
            answer: answer,
        })
    })
    if (!response.ok) {
        notifyApiCallError(`Could not submit an answer`)
        return false
    }
    
    return true
}
