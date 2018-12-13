/*
 * Library for storing and editing data
 *
 */

// Dependencies
var fs = require('fs');
var path = require('path');
var helpers = require('./helpers');
//var Promise = require('Promise')
// Container for module (to be exported)
var lib = {};

// Base directory of data folder
lib.baseDir = path.join(__dirname,'/../.data/');

// Write data to a file
lib.create = function(dir,file,data,callback){
  // Open the file for writing
  fs.open(lib.baseDir+dir+'/'+file+'.json', 'wx', function(err, fileDescriptor){
    if(!err && fileDescriptor){
      // Convert data to string
      var stringData = JSON.stringify(data);

      // Write to file and close it
      fs.writeFile(fileDescriptor, stringData,function(err){
        if(!err){
          fs.close(fileDescriptor,function(err){
            if(!err){
              callback(false);
            } else {
              callback('Error closing new file');
            }
          });
        } else {
          callback('Error writing to new file');
        }
      });
    } else {
      callback('Could not create new file, it may already exist');
    }
  });

};

//Open the file for Writing - Promise 
lib.createPromisify = (dir, file, data)=>{  
  return new Promise((resolve, reject)=>{
    //Open file for writing 
    fs.open(lib.baseDir+dir+'/'+file+'.json','wx', (err, fileDescriptor)=>{
      if(!err && fileDescriptor){
        //Convert data to string
        const stringData = JSON.stringify(data)
        //Write to file and close it
        fs.writeFile(fileDescriptor, stringData, (err)=>{
          if(!err){
            fs.close(fileDescriptor, (err)=>{
              if(!err){
                resolve(true)
              }else{
                reject('Error closing new file.')
              }
            })
          }else{
            reject('Error writing to new file')
          }
        })
      }else{
        reject('Could not create new file, it may already exist')
      }
    })
  })
}

// Read data from a file
lib.read = function(dir,file,callback){
  fs.readFile(lib.baseDir+dir+'/'+file+'.json', 'utf8', function(err,data){
    if(!err && data){
      var parsedData = helpers.parseJsonToObject(data);
      callback(false,parsedData);
    } else {
      callback(err,data);
    }
  });
};

//Read data from file - Promise
lib.readPromisify = (dir, file)=>{
  return new Promise((resolve, reject)=>{
    fs.readFile(lib.baseDir+dir+'/'+file+'.json', 'utf8', (err,data)=>{
      if(!err && data){
        var parsedData = helpers.parseJsonToObject(data)
        resolve(parsedData)
      }else{        
        reject(err)
      }
    })
  })
}

// Update data in a file
lib.update = function(dir,file,data,callback){
  // Open the file for writing
  fs.open(lib.baseDir+dir+'/'+file+'.json', 'r+', function(err, fileDescriptor){
    if(!err && fileDescriptor){
      // Convert data to string
      var stringData = JSON.stringify(data);

      // Truncate the file
      fs.ftruncate(fileDescriptor,function(err){
        if(!err){
          // Write to file and close it
          fs.writeFile(fileDescriptor, stringData,function(err){
            if(!err){
              fs.close(fileDescriptor,function(err){
                if(!err){
                  callback(false);
                } else {
                  callback('Error closing existing file');
                }
              });
            } else {
              callback('Error writing to existing file');
            }
          });
        } else {
          callback('Error truncating file');
        }
      });
    } else {
      callback('Could not open file for updating, it may not exist yet');
    }
  });

};

// Update data in a file - Promise
lib.updatePromisify = (dir, file, data)=>{
  return new Promise((resolve, reject)=>{
    fs.open(lib.baseDir+dir+'/'+file+'.json','r+',(err, fileDescriptor)=>{
      if(!err && fileDescriptor){
        fs.ftruncate(fileDescriptor, (err)=>{
          if(!err){
            fs.writeFile(fileDescriptor, JSON.stringify(data),(err)=>{
              if(!err){
                fs.close(fileDescriptor, (err)=>{
                  if(!err){
                    resolve(false)
                  }else{
                    reject('Error while closing file after update')
                  }
                })
              }else{
                reject('Failed to update the file.')
              }
            })
          }else{
            reject('Error while truncating file.')
          }
        })
      }else{
        reject('File to open the file.')
      }
    })
  })
}
// Delete a file
lib.delete = function(dir,file,callback){

  // Unlink the file from the filesystem
  fs.unlink(lib.baseDir+dir+'/'+file+'.json', function(err){
    callback(err);
  });

};


//Delete a file - Promisify
lib.deletePromisify = (dir, file)=>{
  return new Promise((resolve, reject)=>{
    fs.unlink(lib.baseDir+dir+'/'+file+'.json', (err)=>{
      resolve(err)
    })
  })
}

// List all the items in a directory
lib.list = function(dir,callback){
  fs.readdir(lib.baseDir+dir+'/', function(err,data){
    if(!err && data && data.length > 0){
      var trimmedFileNames = [];
      data.forEach(function(fileName){
        trimmedFileNames.push(fileName.replace('.json',''));
      });
      callback(false,trimmedFileNames);
    } else {
      callback(err,data);
    }
  });
};

// Export the module
module.exports = lib;
