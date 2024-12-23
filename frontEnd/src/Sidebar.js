import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";

const Sidebar = ({ users, user, socket }) => {
  const sideBarRef = useRef(null);
  const [givePermission, setGivePermission] = useState(false);

  const openSideBar = () => {
    sideBarRef.current.style.left = 0;
  };
  const closeSideBar = () => {
    sideBarRef.current.style.left = -100 + "%";
  };
  const handleClick = (usr) => {
    setGivePermission((prev) => {
      return !prev;
    });
    usr.client = givePermission;
    socket.emit("give_permission", usr);
    console.log(usr.client);
  };

  return (
    <>
      <button
        className="btn btn-dark btn-sm"
        onClick={openSideBar}
        style={{ position: "absolute", top: "5%", left: "5%" }}
      >
        Users
      </button>
      <div
        className="position-fixed pt-2 h-100 bg-dark"
        ref={sideBarRef}
        style={{
          width: "150px",
          left: "-100%",
          transition: "0.3s linear",
          zIndex: "9999",
        }}
      >
        <button
          className="btn btn-block border-0 form-control rounded-0 btn-light"
          onClick={closeSideBar}
        >
          Close
        </button>
        <div className="w-100 mt-5">
          {users.map((usr, index) => (
            <>
              <p key={index} className="text-white text-center py-2">
                {usr.username}
                {usr.id === socket.id && " - (You)"}
              </p>
              <button onClick={() => handleClick(usr)}>Give Permission</button>
            </>
          ))}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
