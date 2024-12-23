import React, { useEffect, useRef, useState } from "react";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { toast } from "react-toastify";
import Draggable from "react-draggable";
import html2canvas from "html2canvas"; // Import for downloading canvas with sticky notes
import Canvas from "./Canvas";
import Chat from "./Chat";
import ChatWithAi from "./ChatWithAi";
import "./style.css";
import "./Room.css";

const Room = ({ userNo, user, socket, setUsers, setUserNo }) => {
  const canvasRef = useRef(null);
  const ctx = useRef(null);
  const [color, setColor] = useState("#000000");
  const [elements, setElements] = useState([]);
  const [stickyNotes, setStickyNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [tool, setTool] = useState("pencil");
  const [isChatVisible, setChatVisible] = useState(false);
  const [isShapeDropdownVisible, setShapeDropdownVisible] = useState(false);
  const [isUserClient, serUserClient] = useState(false);

  useEffect(() => {
    socket.on("message", (data) => {
      toast.info(data.message);
    });

    return () => {
      socket.off("message");
    };
  }, []);

  useEffect(() => {
    socket.on("users", (data) => {
      setUsers(data);
      setUserNo(data.length);
    });

    socket.emit("presenter", {
      color,
      tool,
      elements,
      user,
      roomId: user.roomId,
    });

    return () => {
      socket.off("users");
    };
  }, [user]);

  useEffect(() => {
    socket.on("clear-canvas", () => {
      clearCanvasLocal();
    });

    socket.on("undo-canvas", (undoneElement) => {
      undoCanvasLocal(undoneElement);
    });

    socket.on("redo-canvas", (redoneElement) => {
      redoCanvasLocal(redoneElement);
    });

    //sticky notes
    socket.on("sticky-notes-update", (notes) => {
      setStickyNotes(notes);
    });

    socket.on("sticky-note-position-update", ({ id, position }) => {
      setStickyNotes((prevNotes) =>
        prevNotes.map((note) => (note.id === id ? { ...note, position } : note))
      );
    });

    // Listen for permission granted event
    socket.on("permission_granted", (updatedUser) => {
      serUserClient(updatedUser.client);
      console.log(
        `Permission granted to: ${updatedUser.username}, client: ${updatedUser.client}`
      );
      // Update the users state if necessary
      setUsers((prevUsers) =>
        prevUsers.map((usr) => (usr.id === updatedUser.id ? updatedUser : usr))
      );
    });

    return () => {
      socket.off("clear-canvas");
      socket.off("undo-canvas");
      socket.off("redo-canvas");
      socket.off("sticky-notes-update");
      socket.off("sticky-note-position-update");
      socket.off("permission_granted"); // Clean up the listener
    };
  }, [socket, elements, history]);

  const clearCanvasLocal = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setElements([]);
    setStickyNotes([]);
  };

  const clearCanvas = () => {
    clearCanvasLocal();
    socket.emit("clear-canvas");
  };

  const undoCanvasLocal = (undoneElement) => {
    if (undoneElement) {
      setHistory((prevHistory) => [...prevHistory, undoneElement]);
      setElements((prevElements) =>
        prevElements.filter((ele) => ele.id !== undoneElement.id)
      );
    }
  };

  const undo = () => {
    const lastElement = elements[elements.length - 1];
    if (lastElement) {
      undoCanvasLocal(lastElement);
      socket.emit("undo-canvas");
    }
  };

  const redoCanvasLocal = (redoneElement) => {
    if (redoneElement) {
      setElements((prevElements) => [...prevElements, redoneElement]);
      setHistory((prevHistory) =>
        prevHistory.filter((ele) => ele.id !== redoneElement.id)
      );
    }
  };

  const redo = () => {
    const lastHistoryElement = history[history.length - 1];
    if (lastHistoryElement) {
      redoCanvasLocal(lastHistoryElement);
      socket.emit("redo-canvas", lastHistoryElement);
    }
  };

  const handleShapeSelection = (shape) => {
    setTool(shape);
    setShapeDropdownVisible(false); // Close the dropdown after selection
  };

  const addStickyNote = () => {
    const newNote = {
      id: Date.now(),
      text: "Double-click to edit",
      position: { x: 250, y: 150 },
    };
    setStickyNotes([...stickyNotes, newNote]);
    socket.emit("sticky-note-add", newNote);
  };

  const updateStickyNote = (id, newText) => {
    setStickyNotes((prevNotes) =>
      prevNotes.map((note) =>
        note.id === id ? { ...note, text: newText } : note
      )
    );
    socket.emit("sticky-note-update", { id, newText });
  };

  const moveStickyNote = (id, position) => {
    // Update local state
    setStickyNotes((prevNotes) =>
      prevNotes.map((note) => (note.id === id ? { ...note, position } : note))
    );

    // Emit the updated position to the server
    socket.emit("sticky-note-move", { id, position });
  };

  // Function to download the canvas as an image
  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "canvas-drawing.png";
    link.click();
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-md-12">
          <h1 className="display-5 pt-4 pb-3 text-center title">
            WELCOME TO LIVE-BOARD <br />{" "}
            <span className="user"> Users Online: {userNo}</span>
          </h1>
        </div>
      </div>
      <div className="row justify-content-center align-items-center text-center py-2">
        {user.client && (
          <div className="col-md-6 d-flex justify-content-around">
            {/* Undo */}
            <button
              type="button"
              className="btn btn-outline-dark"
              disabled={elements.length === 0}
              onClick={() => undo()}
            >
              <i className="fas fa-undo"></i>
            </button>

            {/* Redo */}
            <button
              type="button"
              className="btn btn-outline-dark"
              disabled={history.length < 1}
              onClick={() => redo()}
            >
              <i className="fas fa-redo"></i>
            </button>

            {/* Color Picker */}
            <div className="btn-group">
              <button
                className="btn btn-outline-dark"
                onClick={() =>
                  document.getElementById("hidden-color-picker").click()
                }
              >
                <i className="fas fa-palette"></i>
              </button>
              <input
                id="hidden-color-picker"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{ display: "none" }}
              />
            </div>

            {/* Pencil Tool */}
            <button
              className={`btn btn-outline-dark ${
                tool === "pencil" ? "active" : ""
              }`}
              onClick={() => setTool("pencil")}
            >
              <i className="fas fa-pencil-alt"></i>
            </button>

            {/* Line Tool */}
            <button
              className={`btn btn-outline-dark ${
                tool === "line" ? "active" : ""
              }`}
              onClick={() => setTool("line")}
            >
              <i className="fas fa-slash"></i>
            </button>

            {/* Add Sticky Note */}
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={addStickyNote}
            >
              <i className="fas fa-sticky-note"></i>
            </button>

            {/* Shape Tool Dropdown */}
            <div className="btn-group" style={{ position: "relative" }}>
              <button
                className="btn btn-outline-dark"
                onClick={() => setShapeDropdownVisible(!isShapeDropdownVisible)}
              >
                <i className="fas fa-shapes"></i>
              </button>
              {isShapeDropdownVisible && (
                <div
                  className="dropdown-menu"
                  style={{
                    position: "absolute",
                    top: "-100px",
                    left: "0",
                    zIndex: "9999",
                  }}
                >
                  <button
                    className="dropdown-item"
                    onClick={() => handleShapeSelection("rect")}
                  >
                    Rectangle
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => handleShapeSelection("circle")}
                  >
                    Circle
                  </button>
                  <button
                    className="dropdown-item"
                    onClick={() => handleShapeSelection("triangle")}
                  >
                    Triangle
                  </button>
                </div>
              )}
            </div>

            {/* Clear Canvas */}
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={clearCanvas}
            >
              <i className="fas fa-trash-alt"></i>
            </button>

            {/* Chat Toggle */}
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={() => setChatVisible(!isChatVisible)}
            >
              <i className="fas fa-comments"></i>
            </button>

            {/* Copy Room ID */}
            <CopyToClipboard
              text={user.roomId}
              onCopy={() => toast.success("Room ID Copied to Clipboard!")}
            >
              <button className="btn btn-outline-dark">
                <i className="fas fa-link"></i>
              </button>
            </CopyToClipboard>

            {/* Download Canvas */}
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={downloadCanvas}
            >
              <i className="fas fa-download"></i>
            </button>
          </div>
        )}
      </div>
      {stickyNotes.map((note) => (
        <Draggable
          key={note.id}
          position={{ x: note.position.x, y: note.position.y }} // Controlled position
          onStop={(e, data) => {
            const newPosition = { x: data.x, y: data.y };
            moveStickyNote(note.id, newPosition); // Update local state
            socket.emit("sticky-note-move", {
              id: note.id,
              position: newPosition,
            }); // Emit new position
          }}
        >
          <div
            style={{
              position: "absolute",
              background: "#fff",
              padding: "10px",
              borderRadius: "5px",
              width: "150px",
              cursor: "move",
              // border: "1px solid #ccc",
              boxShadow: "0 2px 5px rgba(0, 0, 0, 0.2)",
            }}
          >
            <div
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => updateStickyNote(note.id, e.target.textContent)}
            >
              {note.text}
            </div>
          </div>
        </Draggable>
      ))}

      <div className="row">
        {
          <Canvas
            canvasRef={canvasRef}
            ctx={ctx}
            color={color}
            setElements={setElements}
            elements={elements}
            tool={tool}
            socket={socket}
            isUserClient={isUserClient}
          />
        }
      </div>
      {/* Chat Component */}
      {isChatVisible && (
        <div className="Chat">
          <Chat user={user} />
          <ChatWithAi />
        </div>
      )}
    </div>
  );
};

export default Room;
