/*
 * Request Handlers
 *
 */

// Dependencies
var _data = require('./data');
var helpers = require('./helpers');
var config = require('./config');

// Define all the handlers
var handlers = {};

// Ping
handlers.ping = function (data, callback) {
  setTimeout(function () {
    callback(200);
  }, 5000);

};

// Not-Found
handlers.notFound = function (data, callback) {
  callback(404);
};

// Users
handlers.users = function (data) {
  return new Promise((resolve, reject) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
      resolve(handlers._users[data.method](data))
    } else {
      reject({ statusCode: 405 })
    }
  })
};

// Container for all the users methods
handlers._users = {};
// Users - post - promisy
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data) => {
  return new Promise((resolve, reject) => {
    // Check that all required fields are filled out
    var firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false
    var lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false
    var tosAgreement = typeof (data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true : false
    if (firstName && lastName && phone && password && tosAgreement) {
      // Make sure the user doesnt already exist
      _data.readPromisify('users', phone)
        .then(() => {
          reject(400, { 'Error': 'A user with that phone number already exists' })
        }, () => {
          // Hash the password      
          var hashedPassword = helpers.hash(password)
          // Create the user object
          if (hashedPassword) {
            var userObject = {
              'firstName': firstName,
              'lastName': lastName,
              'phone': phone,
              'hashedPassword': hashedPassword,
              'tosAgreement': true
            };
            // Store the user            
            _data.createPromisify('users', phone, userObject)
              .then(() => {
                resolve(200)
              }, () => {
                reject(500, { 'Error': 'An error occurs while creating the user.' })
              })
              .catch(() => {
                reject(500, { 'Error': 'An error occurs while creating the user.' })
              })
          } else {
            reject(500, { 'Error': 'Could not hash the user\'s password.' })
          }
        })
        .catch(() => {
          reject(500, { 'Error': 'An error occurs while creating the user.' })
        })
    } else {
      reject(400, { 'Error': 'Missing required fields' });
    }
  })
}

// Required data: phone
// Optional data: none
handlers._users.get = (data) => {
  return new Promise((resolve, reject) => {
    // Check that phone number is valid
    var phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
      // Get token from headers
      var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
      // Verify that the given token is valid for the phone number
      handlers._tokens.verifyTokenPromisify(token, phone)
        .then((tokenIsValid) => {
          if (tokenIsValid) {
            // Lookup the user
            _data.readPromisify('users', phone)
              .then((data) => {
                // Remove the hashed password from the user user object before returning it to the requester
                delete data.hashedPassword;
                resolve({ statusCode: 200, payload: data });
              }, () => {
                reject({ statusCode: 404 });
              });
          } else {
            reject({ statusCode: 403, payload: { "Error": "Missing required token in header, or token is invalid." } })
          }
        })
        .catch(() => {
          reject({ statusCode: 500, payload: { 'Error': 'An error occures while verifying the token.' } })
        })
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field' } })
    }
  })
};

// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = (data) => {
  return new Promise((resolve, reject) => {
    // Check for required field
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    // Check for optional fields
    var firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
    var lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    // Error if phone is invalid
    if (phone) {
      // Error if nothing is sent to update
      if (firstName || lastName || password) {
        // Get token from headers
        var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
        // Verify that the given token is valid for the phone number
        handlers._tokens.verifyTokenPromisify(token, phone)
          .then((tokenIsValid) => {
            if (tokenIsValid) {
              // Lookup the user
              _data.readPromisify('users', phone)
                .then((userData) => {
                  // Update the fields if necessary
                  if (firstName) {
                    userData.firstName = firstName;
                  }
                  if (lastName) {
                    userData.lastName = lastName;
                  }
                  if (password) {
                    userData.hashedPassword = helpers.hash(password);
                  }
                  _data.updatePromisify('users', phone, userData)
                    .then(() => {
                      delete userData.hashedPassword;
                      resolve({ statusCode: 200, payload: userData })
                    }, () => {
                      reject({ statusCode: 500, payload: { 'Error': 'Could not update the user.' } });
                    })
                }, () => {
                  reject({ statusCode: 400, payload: { 'Error': 'Specified user does not exist.' } });
                })
                .catch(() => {
                  reject({ statusCode: 500, payload: { 'Error': 'An error occurs while updating user informations.' } });
                })
            } else {
              reject({ statusCode: 403, payload: { "Error": "Missing required token in header, or token is invalid." } });
            }
          })
          .catch(() => {
            reject({ statusCode: 500, payload: { 'Error': 'An error occurs while updating user informations.' } })
          })
      } else {
        reject({ statusCode: 400, payload: { 'Error': 'Missing fields to update.' } });
      }
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field.' } });
    }

  })
};

// Required data: phone
// Cleanup old checks associated with the user
handlers._users.delete = (data) => {
  return new Promise((resolve, reject) => {
    // Check that phone number is valid
    var phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
    if (phone) {
      // Get token from headers
      var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
      // Verify that the given token is valid for the phone number
      handlers._tokens.verifyTokenPromisify(token, phone)
        .then((tokenIsValid) => {
          if (tokenIsValid) {
            // Lookup the user
            _data.read('users', phone, function (err, userData) {
              if (!err && userData) {
                _data.deletePromisify('users', phone)
                  .then((err) => {
                    if (!err) {
                      // Delete each of the checks associated with the user
                      var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                      var checksToDelete = userChecks.length;
                      if (checksToDelete > 0) {
                        var checksDeleted = 0;
                        var deletionErrors = false;
                        // Loop through the checks
                        userChecks.forEach(function (checkId) {
                          // Delete the check
                          _data.delete('checks', checkId, function (err) {
                            if (err) {
                              deletionErrors = true;
                            }
                            checksDeleted++;
                            if (checksDeleted == checksToDelete) {
                              if (!deletionErrors) {
                                resolve({ statusCode: 200 });
                              } else {
                                reject({ statusCode: 500, payload: { 'Error': "Errors encountered while attempting to delete all of the user's checks. All checks may not have been deleted from the system successfully." } })
                              }
                            }
                          });
                        });
                      } else {
                        resolve({ statusCode: 200 });
                      }
                    } else {
                      reject({ statusCode: 500, payload: { 'Error': 'Could not delete the specified user' } })
                    }
                  })
              } else {
                reject({ statusCode: 400, payload: { 'Error': 'Could not find the specified user.' } })
              }
            });
          } else {
            reject({ statusCode: 403, payload: { "Error": "Missing required token in header, or token is invalid." } })
          }
        })
        .catch(() => {
          reject({ statusCode: 500, payload: { 'Error': 'Could not delete the specified user' } });
        })
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field' } })
    }
  })
};

// Tokens
handlers.tokens = function (data) {
  return new Promise((resolve, reject) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
      resolve(handlers._tokens[data.method](data))
    } else {
      reject(405);
    }
  })
};

// Container for all the tokens methods
handlers._tokens = {};

// Tokens - post
// Required data: phone, password
// Optional data: none
handlers._tokens.post = (data) => {
  return new Promise((resolve, reject) => {
    var phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
    var password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    if (phone && password) {
      // Lookup the user who matches that phone number
      _data.readPromisify('users', phone)
        .then((userData) => {
          // Hash the sent password, and compare it to the password stored in the user object
          var hashedPassword = helpers.hash(password);
          if (hashedPassword == userData.hashedPassword) {
            // If valid, create a new token with a random name. Set an expiration date 1 hour in the future.
            var tokenId = helpers.createRandomString(20);
            var expires = Date.now() + 1000 * 60 * 60;
            var tokenObject = {
              'phone': phone,
              'id': tokenId,
              'expires': expires
            };
            _data.createPromisify('tokens', tokenId, tokenObject)
              .then((success) => {
                if (success) {
                  resolve({ statusCode: 200, payload: tokenObject })
                }
              }, () => {
                reject({ statusode: 500, payload: { 'Error': 'Could not create the new token' } })
              })
              .catch(() => {
                reject({ statusCode: 500, payload: { 'Error': 'An error occurs while creating a token .' } })
              })
          } else {
            reject({ statusCode: 400, payload: { 'Error': 'Password did not match the specified user\'s stored password' } });
          }
        }, () => {
          reject({ statusCode: 400, payload: { 'Error': 'Could not find the specified user.' } })
        })
        .catch(() => {
          reject({ statusCode: 500, payload: { 'Error': 'An error occurs while creating a token .' } })
        })
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field(s).' } })
    }
  })
}

// Tokens - get - Promisify
// Required data: id
// Optional data: none
handlers._tokens.get = (data) => {
  return new Promise((resolve, reject) => {
    // Check that id is valid
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
      // Lookup the token
      _data.readPromisify('tokens', id)
        .then((payload) => {
          resolve({ statusCode: 200, payload });
        })
        .catch(() => {
          reject({ statusCode: 500, payloada: { 'Error': 'An Errors occuring while retrieving the token.' } })
        })
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field, or field invalid' } })
    }
  })
}

// Tokens - put - Promisify
// Required data: id, extend
// Optional data: none
handlers._tokens.put = (data) => {
  return new Promise((resolve, reject) => {
    var id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof (data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
    if (id && extend) {
      // Lookup the existing token
      _data.readPromisify('tokens', id)
        .then((tokenData) => {
          if (tokenData) {
            // Check to make sure the token isn't already expired
            if (tokenData.expires > Date.now()) {
              // Set the expiration an hour from now
              tokenData.expires = Date.now() + 1000 * 60 * 60;
              // Store the new updates
              _data.updatePromisify('tokens', id, tokenData)
                .then(function (err) {
                  if (!err) {
                    resolve({ statusCode: 200, payload: tokenData })
                  } else {
                    reject({ statusCode: 500, payload: { 'Error': 'Specified user does not exist.' } })
                  }
                })
                .catch(() => {
                  reject({ statusCode: 500, payload: { 'Error': 'An error occurs while updating user token.' } })
                })
            } else {
              reject({ statusCode: 400, payload: { 'Error': 'Specified user does not exist.' } })
            }
          } else {
            reject({ statusCode: 400, payload: { 'Error': 'Specified user does not exist.' } })
          }
        }, () => {
          reject({ statusCode: 400, payload: { 'Error': 'Specified user does not exist.' } })
        })
        .catch(() => {
          reject({ statusCode: 500, payload: { 'Error': 'An error occurs while updating user token.' } })
        })
    } else {
      reject({ statusCode: 400, payload: { "Error": "Missing required field(s) or field(s) are invalid." } });
    }
  })
};

// Tokens - delete -Promisify
// Required data: id
// Optional data: none
handlers._tokens.delete = function (data) {
  return new Promise((resolve, reject) => {
    // Check that id is valid
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
      // Lookup the token
      _data.readPromisify('tokens', id)
        .then((tokenData) => {
          if (tokenData) {
            // Delete the token
            _data.deletePromisify('tokens', id)
              .then((err) => {
                if (!err) {
                  resolve({ statusCode: 200 })
                } else {
                  reject({ statusCode: 500, payload: { 'Error': 'Could not delete the specified token.' } })
                }
              })
              .catch(() => {
                reject({ statusCode: 500, payload: { 'Error': 'An error occurs while deleting user token.' } })
              })
          } else {
            reject({ statusCode: 400, payload: { 'Error': 'Could not find the specified token.' } })
          }
        })
        .catch(() => {
          reject({ statusCode: 500, payload: { 'Error': 'An error occurs while deleting user token.' } })
        })
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field.' } })
    }
  })
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function (id, phone, callback) {
  // Lookup the token
  _data.read('tokens', id, function (err, tokenData) {
    if (!err && tokenData) {
      // Check that the token is for the given user and has not expired
      if (tokenData.phone == phone && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  });
};
// Verify if a given token id is currently valid for a given user - Promisify
handlers._tokens.verifyTokenPromisify = (id, phone) => {
  return new Promise((resolve, reject) => {
    _data.readPromisify('tokens', id)
      .then((tokenData) => {
        if (tokenData.phone == phone && tokenData.expires > Date.now()) {
          resolve(true)
        } else {
          resolve(false)
        }
      })
      .catch(() => {
        reject(500, 'Error: An error occures while verifying the token.')
      })
  })
}
// Checks
handlers.checks = (data) => {
  return new Promise((resolve, reject) => {
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
      resolve(handlers._checks[data.method](data))
    } else {
      reject({ statusCode: 405 });
    }
  })
}

// Container for all the checks methods
handlers._checks = {};


// Checks - post
// Required data: protocol,url,method,successCodes,timeoutSeconds
// Optional data: none
handlers._checks.post = function (data) {
  return new Promise((resolve, reject) => {
    // Validate inputs
    var protocol = typeof (data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;
    if (protocol && url && method && successCodes && timeoutSeconds) {
      // Get token from headers
      var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

      // Lookup the user phone by reading the token
      _data.readPromisify('tokens', token)
        .then((tokenData) => {
          var userPhone = tokenData.phone;
          //Verify token
          handlers._tokens.verifyTokenPromisify(token, userPhone)
            .then((isValid) => {
              if (isValid) {
                // Lookup the user data
                _data.readPromisify('users', userPhone)
                  .then((userData) => {
                    var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                    // Verify that user has less than the number of max-checks per user
                    if (userChecks.length < config.maxChecks) {
                      // Create random id for check
                      var checkId = helpers.createRandomString(20);

                      // Create check object including userPhone
                      var checkObject = {
                        'id': checkId,
                        'userPhone': userPhone,
                        'protocol': protocol,
                        'url': url,
                        'method': method,
                        'successCodes': successCodes,
                        'timeoutSeconds': timeoutSeconds
                      };

                      // Save the object
                      _data.createPromisify('checks', checkId, checkObject)
                        .then((err) => {
                          if (err) {
                            // Add check id to the user's object
                            userData.checks = userChecks;
                            userData.checks.push(checkId);

                            // Save the new user data
                            _data.update('users', userPhone, userData, function (err) {
                              if (!err) {
                                // Return the data about the new check
                                resolve({ statusCode: 200, payload: checkObject });
                              } else {
                                reject({ statusCode: 500, payload: { 'Error': 'Could not update the user with the new check.' } });
                              }
                            });
                          } else {
                            reject({ statusCode: 500, payload: { 'Error': 'Could not create the new check' } });
                          }
                        })
                        .catch(() => {
                          reject({ statusCode: 500, payload: { 'Error': 'An error occurs during check creation.' } })
                        })
                    } else {
                      reject({ statusCode: 400, payload: { 'Error': 'The user already has the maximum number of checks (' + config.maxChecks + ').' } })
                    }
                  }, () => {
                    reject({ statusCode: 403 })
                  })
              } else {
                reject({ statusCode: 403 })
              }
            })
            .catch(() => {
              reject({ statusCode: 500, payload: { 'Error': 'An error occurs during token verification.' } })
            })
        }, () => {
          reject({ statusCode: 403 })
        })
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required inputs, or inputs are invalid' } });
    }
  })
};

// Checks - get
// Required data: id
// Optional data: none
handlers._checks.get = (data) => {
  return new Promise((resolve, reject) => {
    // Check that id is valid
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
      // Lookup the check
      _data.readPromisify('checks', id)
        .then((checkData) => {
          // Get the token that sent the request
          var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
          // Verify that the given token is valid and belongs to the user who created the check
          handlers._tokens.verifyTokenPromisify(token, checkData.userPhone)
            .then((tokenIsValid) => {
              if (tokenIsValid) {
                // Return check data
                resolve({ statusCode: 200, payload: checkData });
              } else {
                resolve({ statusCode: 403 })
              }
            })
        }, () => {
          reject({ statusCode: 404 })
        })
        .catch(() => {
          reject({ statusCode: 500, payload: { 'Error': 'An error occurring while trying to get a check details.' } })
        })
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field, or field invalid' } })
    }
  })
};

// Checks - put
// Required data: id
// Optional data: protocol,url,method,successCodes,timeoutSeconds (one must be sent)
handlers._checks.put = (data) => {
  return new Promise((resolve, reject) => {
    // Check for required field
    var id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

    // Check for optional fields
    var protocol = typeof (data.payload.protocol) == 'string' && ['https', 'http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    var url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    var method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    var successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    var timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    // Error if id is invalid
    if (id) {
      // Error if nothing is sent to update
      if (protocol || url || method || successCodes || timeoutSeconds) {
        // Lookup the check
        _data.readPromisify('checks', id)
          .then((checkData) => {
            // Get the token that sent the request
            var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
            // Verify that the given token is valid and belongs to the user who created the check
            handlers._tokens.verifyTokenPromisify(token, checkData.userPhone)
              .then((tokenIsValid) => {
                if (tokenIsValid) {
                  // Update check data where necessary
                  if (protocol) {
                    checkData.protocol = protocol;
                  }
                  if (url) {
                    checkData.url = url;
                  }
                  if (method) {
                    checkData.method = method;
                  }
                  if (successCodes) {
                    checkData.successCodes = successCodes;
                  }
                  if (timeoutSeconds) {
                    checkData.timeoutSeconds = timeoutSeconds;
                  }
                  // Store the new updates
                  _data.updatePromisify('checks', id, checkData)
                    .then((err) => {
                      if (!err) {
                        resolve({ statusCode: 200, payload: checkData });
                      } else {
                        reject({ statusCode: 500, payload: { 'Error': 'Could not update the check.' } });
                      }
                    })
                    .catch(() => {
                      reject({ statusCode: 500, payload: { 'Error': 'An error occurs while updating an existing check.' } })
                    })
                } else {
                  reject({ statusCode: 403 })
                }
              })
              .catch(() => {
                reject({ statusCode: 500, payload: { 'Error': 'An error occurs while updatins an existing check.' } })
              })

          }, () => {
            reject({ statusCode: 400, payload: { 'Error': 'Check ID did not exist.' } })
          })
          .catch(() => {
            reject({ statusCode: 500, payload: { 'Error': 'An error occurs while updatins an existing check.' } })
          })
      } else {
        reject({ statusCode: 400, payload: { 'Error': 'Missing fields to update.' } })
      }
    } else {
      reject({ statusCode: 400, payload: { 'Error': 'Missing required field.' } })
    }
  })
};


// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = function (data, callback) {
  return new Promise((resolve, reject) => {
    // Check that id is valid
    var id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if (id) {
      // Lookup the check
      _data.readPromisify('checks', id)
        .then((checkData) => {
          // Get the token that sent the request
          var token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
          // Verify that the given token is valid and belongs to the user who created the check
          handlers._tokens.verifyTokenPromisify(token, checkData.userPhone)
            .then((tokenIsValid) => {
              if (tokenIsValid) {

                // Delete the check data
                _data.deletePromisify('checks', id)
                  .then((err) => {
                    if (!err) {
                      // Lookup the user's object to get all their checks
                      _data.readPromisify('users', checkData.userPhone)
                        .then((userData) => {
                          var userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                          // Remove the deleted check from their list of checks
                          var checkPosition = userChecks.indexOf(id);
                          if (checkPosition > -1) {
                            userChecks.splice(checkPosition, 1);
                            // Re-save the user's data
                            userData.checks = userChecks;
                            _data.updatePromisify('users', checkData.userPhone, userData)
                              .then((err) => {
                                if (!err) {
                                  resolve({ statusCode: 200 });
                                } else {
                                  reject({ statusCode: 500, payload: { 'Error': 'Could not update the user.' } })
                                }
                              });
                          } else {
                            reject({ statusCode: 500, payload: { "Error": "Could not find the check on the user's object, so could not remove it." } });
                          }

                        }, () => {
                          reject({ statusCode: 500, payload: { "Error": "Could not find the user who created the check, so could not remove the check from the list of checks on their user object." } });
                        })
                        .catch(() => {
                          reject({ statusCode: 500, payload: { 'Error': 'An error occurs while deleting an existing check.' } })
                        })
                    } else {
                      reject({ statusCode: 500, payload: { "Error": "Could not delete the check data." } })
                    }
                  })
                  .catch(() => {
                    reject({ statusCode: 500, payload: { 'Error': 'An error occurs while deleting an existing check.' } })
                  })
              } else {
                reject({ statusCode: 403 });
              }
            });

        }, () => {
          reject({ statusCode: 400, payload: { "Error": "The check ID specified could not be found" } });
        })
        .catch(() => {
          reject({ statusCode: 500, payload: { 'Error': 'An error occurs while deleting an existing check.' } })
        })
    } else {
      reject({ statusCode: 400, payload: { "Error": "Missing valid id" } });
    }
  })
};


// Export the handlers
module.exports = handlers;
