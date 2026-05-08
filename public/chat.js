const pathParts = window.location.pathname.split('/').filter(Boolean);
const receiverId = Number(pathParts[pathParts.length - 1]);

let socket = null;
let messages = [];
let currentUser = null;
let replyToId = null;
let activeConversationId = null;
let typingTimeout = null;

const tokenInput = document.getElementById('tokenInput');
const statusBox = document.getElementById('status');
const messagesBox = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const replyingBox = document.getElementById('replying');
const replyIdBox = document.getElementById('replyId');
const receiverIdText = document.getElementById('receiverIdText');

receiverIdText.textContent = receiverId;

const savedToken = localStorage.getItem('chat_token');

if (savedToken) {
    tokenInput.value = savedToken;
}

if (!receiverId || Number.isNaN(receiverId)) {
    setStatus('Invalid receiver id in URL', true);
}

function connectChat() {
    const token = tokenInput.value.trim();

    if (!token) {
        setStatus('Please paste your token first', true);
        return;
    }

    localStorage.setItem('chat_token', token);

    if (socket) {
        socket.disconnect();
    }

    socket = io({
        auth: {
            token: token,
        },
    });

    socket.on('connect', function () {
        setStatus('Connected. Opening conversation...', false);

        socket.emit('openDirectConversation', {
            receiverId: receiverId,
        });
    });

    socket.on('connected', function (data) {
        currentUser = data.user;
        updateConnectedStatus();
    });

    socket.on('conversationReady', function (data) {
        activeConversationId = data.conversation.id;
        messages = data.messages || [];

        updateConnectedStatus();
        renderMessages();
    });

    socket.on('newMessage', function (data) {
        if (!data.message) {
            return;
        }

        if (
            activeConversationId &&
            data.message.conversationId !== activeConversationId
        ) {
            return;
        }

        const exists = messages.some(function (message) {
            return message.id === data.message.id;
        });

        if (!exists) {
            messages.push(data.message);
        }

        renderMessages();
    });

    socket.on('messageReactionUpdated', function (data) {
        const message = messages.find(function (message) {
            return message.id === data.messageId;
        });

        if (message) {
            message.reactions = data.reactions;
            renderMessages();
        }
    });

    socket.on('userTyping', function (data) {
        if (
            activeConversationId &&
            data.conversationId !== activeConversationId
        ) {
            return;
        }

        setStatus(data.username + ' is typing...', false);

        clearTimeout(typingTimeout);

        typingTimeout = setTimeout(function () {
            updateConnectedStatus();
        }, 1000);
    });

    socket.on('chatError', function (data) {
        setStatus(data.message, true);
    });

    socket.on('disconnect', function () {
        setStatus('Disconnected', true);
    });
}

function sendMessage() {
    if (!socket || !socket.connected) {
        setStatus('Connect first', true);
        return;
    }

    if (!activeConversationId) {
        setStatus('Conversation is not ready yet', true);
        return;
    }

    const content = messageInput.value.trim();

    if (!content) {
        return;
    }

    socket.emit('sendMessage', {
        conversationId: activeConversationId,
        content: content,
        replyToId: replyToId,
    });

    messageInput.value = '';
    cancelReply();
}

function reactToMessage(messageId, emoji) {
    if (!socket || !socket.connected) {
        setStatus('Connect first', true);
        return;
    }

    socket.emit('reactToMessage', {
        messageId: messageId,
        emoji: emoji,
    });
}

function startReply(messageId) {
    replyToId = messageId;
    replyIdBox.textContent = messageId;
    replyingBox.style.display = 'block';
    messageInput.focus();
}

function cancelReply() {
    replyToId = null;
    replyIdBox.textContent = '';
    replyingBox.style.display = 'none';
}

messageInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', function () {
    if (!socket || !socket.connected || !activeConversationId) {
        return;
    }

    socket.emit('typing', {
        conversationId: activeConversationId,
    });
});

function renderMessages() {
    messagesBox.innerHTML = '';

    messages.forEach(function (message) {
        const div = document.createElement('div');
        const isMine = currentUser && message.senderId === currentUser.id;

        div.className = isMine ? 'message mine' : 'message';

        let reactionsHtml = '';

        if (message.reactions && message.reactions.length > 0) {
            reactionsHtml = message.reactions
                .map(function (reaction) {
                    return (
                        '<span>' +
                        escapeHtml(reaction.emoji) +
                        ' ' +
                        reaction.count +
                        '</span>'
                    );
                })
                .join(' ');
        }

        let replyHtml = '';

        if (message.replyTo) {
            replyHtml =
                '<div class="reply">Reply to <strong>' +
                escapeHtml(
                    message.replyTo.senderUsername ||
                    'User ' + message.replyTo.senderId,
                ) +
                '</strong>: ' +
                escapeHtml(message.replyTo.content) +
                '</div>';
        }

        div.innerHTML =
            '<div class="meta">' +
            '<strong>' +
            escapeHtml(message.senderUsername || 'User ' + message.senderId) +
            '</strong>' +
            ' - ' +
            new Date(message.createdAt).toLocaleString() +
            '</div>' +
            replyHtml +
            '<div class="content">' +
            escapeHtml(message.content) +
            '</div>' +
            '<div class="actions">' +
            '<button onclick="reactToMessage(' +
            message.id +
            ', \'👍\')">👍</button>' +
            '<button onclick="reactToMessage(' +
            message.id +
            ', \'❤️\')">❤️</button>' +
            '<button onclick="reactToMessage(' +
            message.id +
            ', \'😂\')">😂</button>' +
            '<button onclick="reactToMessage(' +
            message.id +
            ', \'🔥\')">🔥</button>' +
            '<button onclick="startReply(' +
            message.id +
            ')">Reply</button>' +
            '<span>' +
            reactionsHtml +
            '</span>' +
            '</div>';

        messagesBox.appendChild(div);
    });

    messagesBox.scrollTop = messagesBox.scrollHeight;
}

function updateConnectedStatus() {
    if (!currentUser) {
        setStatus('Connected', false);
        return;
    }

    if (!activeConversationId) {
        setStatus('Connected as ' + currentUser.username, false);
        return;
    }

    setStatus(
        'Connected as ' +
        currentUser.username +
        ' - conversation ' +
        activeConversationId,
        false,
    );
}

function setStatus(message, isError) {
    statusBox.textContent = message;
    statusBox.className = isError ? 'status error' : 'status';
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}