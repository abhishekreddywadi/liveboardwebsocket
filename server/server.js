const express = require("express");
const http = require("http");
const cors = require("cors");
const socketIO = require("socket.io");
const { userJoin, getUsers, userLeave } = require("./utils/user");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(cors());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

// Room states
let roomDrawings = {};
let roomStickyNotes = {};

io.on("connection", (socket) => {
  let userRoom = null;

  // When a user joins a room
  socket.on("user-joined", (data) => {
    const { roomId, userName } = data;
    userRoom = roomId;

    // Add user to room
    const user = userJoin(socket.id, userName, roomId);
    const roomUsers = getUsers(roomId);

    socket.join(userRoom);

    // Notify users about the new join
    socket.emit("chat message", { message: "Welcome to the Chat Room" });
    socket.broadcast.to(userRoom).emit("chat message", {
      message: `${user.username} has joined`,
    });

    // Update the room's user list
    io.to(userRoom).emit("users", roomUsers);

    // Send existing room state to the new user
    socket.emit("canvasImage", roomDrawings[userRoom] || []);
    socket.emit("sticky-notes-update", roomStickyNotes[userRoom] || []);
  });

  // Drawing update
  socket.on("drawing-update", (data) => {
    if (!roomDrawings[userRoom]) {
      roomDrawings[userRoom] = [];
    }

    roomDrawings[userRoom].push(data);

    // Broadcast the updated drawing data to the room
    io.to(userRoom).emit("canvasImage", roomDrawings[userRoom]);
  });

  // Clear canvas
  socket.on("clear-canvas", () => {
    if (roomDrawings[userRoom]) {
      roomDrawings[userRoom] = [];
    }
    io.to(userRoom).emit("clear-canvas");
  });
  // permisison
  socket.on("give_permission", (user) => {
    console.log("Received user object:", user); // Log the entire user object
    // user.client = true; // Set client to true for the specific user

    // Log the updated user information
    console.log(`User updated: ${user.username}, client: ${user.client}`);

    // Emit the updated user information to all clients in the room
    io.to(userRoom).emit("permission_granted", user);
  });
  // Undo action
  socket.on("undo-canvas", () => {
    if (roomDrawings[userRoom] && roomDrawings[userRoom].length > 0) {
      roomDrawings[userRoom].pop();
      io.to(userRoom).emit("canvasImage", roomDrawings[userRoom]);
    }
  });

  // Redo action
  socket.on("redo-canvas", (redoneElement) => {
    if (redoneElement) {
      roomDrawings[userRoom].push(redoneElement);
      io.to(userRoom).emit("canvasImage", roomDrawings[userRoom]);
    }
  });

  // Chat message handling
  socket.on("chat message", (msg) => {
    try {
      io.to(userRoom).emit("chat message", msg);
    } catch (error) {
      console.error("Error in chat message:", error);
    }
  });

  // Sticky note add
  socket.on("sticky-note-add", (note) => {
    if (!roomStickyNotes[userRoom]) {
      roomStickyNotes[userRoom] = [];
    }
    roomStickyNotes[userRoom].push(note);
    io.to(userRoom).emit("sticky-notes-update", roomStickyNotes[userRoom]);
  });

  // Sticky note move (fix with consistent broadcast)
  socket.on("sticky-note-move", (data) => {
    if (roomStickyNotes[userRoom]) {
      const noteIndex = roomStickyNotes[userRoom].findIndex(
        (note) => note.id === data.id
      );

      if (noteIndex !== -1) {
        // Update the note's position in server state
        roomStickyNotes[userRoom][noteIndex].position = data.position;

        // console.log(`Updating position for note ${data.id}:`, data.position);

        // Broadcasting the updated position to ALL clients in the room
        io.to(userRoom).emit("sticky-note-position-update", {
          id: data.id,
          position: data.position,
        });
      }
    }
  });

  // Sticky note update
  socket.on("sticky-note-update", ({ id, newText }) => {
    if (roomStickyNotes[userRoom]) {
      const noteIndex = roomStickyNotes[userRoom].findIndex(
        (note) => note.id === id
      );
      if (noteIndex !== -1) {
        roomStickyNotes[userRoom][noteIndex].text = newText;
        io.to(userRoom).emit("sticky-notes-update", roomStickyNotes[userRoom]);
      }
    }
  });

  // Updated sticky note move operation
  socket.on("sticky-note-move", (data) => {
    if (roomStickyNotes[userRoom]) {
      const noteIndex = roomStickyNotes[userRoom].findIndex(
        (note) => note.id === data.id
      );

      if (noteIndex !== -1) {
        // Update the note's position
        roomStickyNotes[userRoom][noteIndex].position = data.position;

        // Log to verify broadcast is working
        // console.log(
        //   `Broadcasting position for note ${data.id}:`,
        //   data.position
        // );

        // Broadcast the updated sticky note position to all other clients in the room
        socket.broadcast.to(userRoom).emit("sticky-note-position-update", {
          id: data.id,
          position: data.position,
        });

        // send the update to the user who moved the sticky note
        socket.emit("sticky-note-position-update", {
          id: data.id,
          position: data.position,
        });
      }
    }
  });

  // Chat message
  socket.on("chat message", (msg) => {
    try {
      io.emit("chat message", msg);
    } catch (error) {
      console.error("Error in chat message:", error);
    }
  });

  // When a user disconnects
  socket.on("disconnect", () => {
    const userLeaves = userLeave(socket.id);
    const roomUsers = getUsers(userRoom);

    if (userLeaves) {
      io.to(userRoom).emit("chat message", {
        message: `${userLeaves.username} left the chat`,
      });

      // Update the room's user list
      io.to(userRoom).emit("users", roomUsers);
    }
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`)
);
