import React, { useState, useEffect } from 'react';
import Home from "./components/home";
import Display from "./components/display";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";


export default function App() {


  return (
    <Router>
      <div>
        <ul className="navbar">
          <li>
            <Link className="nav-bar-link" to="/">Add new data</Link>
          </li>
          <li>
            <Link to="/display">Show data</Link>
          </li>
        </ul>

        <hr />

        {/*
          A <Switch> looks through all its children <Route>
          elements and renders the first one whose path
          matches the current URL. Use a <Switch> any time
          you have multiple routes, but you want only one
          of them to render at a time
        */}
        <Switch>
          <Route exact path="/">
            <Home />
          </Route>
          <Route path="/display">
            <Display />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

