import React from "react";
import { createRoot } from "react-dom/client";
import BoardApp from "./BoardApp.jsx";
import "./board.css";

createRoot(document.getElementById("root")).render(<BoardApp />);
