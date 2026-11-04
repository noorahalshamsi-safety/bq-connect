// Test entry: the real staging worker with the filesystem App Storage stand-in.
// Arguments: <gate root> <stand-in storage directory under bq-forensics-*>.
const {FileStorage}=require("../forensics/file-storage.cjs");
require("../../deploy/staging/runtime.cjs").main({root:process.argv[2],storeClient:new FileStorage(process.argv[3])});
