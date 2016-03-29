#!/usr/bin/env node

"use strict"

let tar = require('tar-fs')
let fs = require('fs')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let net = require('net')
let JsonSocket = require('json-socket')
let request = require("request")
let wrap = require('co-express')
const ROOT_DIR = '/client_dir'

let socket = new JsonSocket(new net.Socket())

socket.connect('8001', '127.0.0.1')

socket.on('connect', function() {
    console.log('Connected to server')
    
    socket.on('message', wrap(function* (message) {
       action = message.action
       type = message.type
       path = message.path
       if(action === 'create'){
                  console.log("create" + ROOT_DIR + path)
                  if (type == 'dir'){
                      yield mkdirp.promise(ROOT_DIR + path)}
                  else {
                        let options = {
                             method: "GET",
                             url: 'http://127.0.0.1:8000/' + path }
                        yield request(options).pipe(fs.createWriteStream(ROOT_DIR + path))}
       }
       else if (action === 'update'){
                  console.log("update" + ROOT_DIR + path)
                  let options = {
                    method: "GET",
                    url: 'http://127.0.0.1:8000/' + path,
                    // headers: {'Accept': 'application/x-gtar'}
            }
            yield request(options).pipe(fs.createWriteStream(ROOT_DIR + path));
       }
       else if (action === 'delete'){
                  console.log("Remove" + ROOT_DIR + path)
                  if (type == 'dir') {
                      yield rimraf.promise(ROOT_DIR + path); }
                  else {
                     yield fs.promise.unlink(ROOT_DIR + path);}
       }
    })
)})
