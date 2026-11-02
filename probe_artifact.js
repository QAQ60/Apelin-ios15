// Probe: reach the GitHub API anonymously with an NSURLSession data task,
// blocking on a semaphore, and print the status code and body prefix.
const NSURL = ObjC.use('NSURL');
const NSMutableURLRequest = ObjC.use('NSMutableURLRequest');
const NSURLSession = ObjC.use('NSURLSession');
const NSString = ObjC.use('NSString');
const NSCondition = ObjC.use('NSCondition');

const api = "https://api.github.com/repos/QAQ60/Apelin/actions/runs/41387696362/artifacts";
const url = NSURL.URLWithString_(api);
const req = NSMutableURLRequest.alloc().initWithURL_(url);
req.setTimeoutInterval_(25);
req.setHTTPMethod_("GET");
req.setValue_forHTTPHeaderField_("ApelinProbe/1", "User-Agent");

let status = -1;
let body = null;
let failure = null;
const condition = NSCondition.alloc().init();
let done = false;

const task = NSURLSession.sharedSession().dataTaskWithRequest_completionHandler_(req, function (data, response, error) {
  if (error) { failure = String(error); }
  else {
    status = response.statusCode();
    const text = NSString.alloc().initWithData_encoding_(data, 4);
    body = text ? text.substringToIndex_(Math.min(400, text.length())) : "(non-utf8)";
  }
  condition.lock();
  done = true;
  condition.signal();
  condition.unlock();
});
task.resume();

condition.lock();
while (!done) { condition.waitUntilDate_(ObjC.use('NSDate').dateWithTimeIntervalSinceNow_(30)); }
condition.unlock();

console.log("status: " + status);
console.log("error: " + failure);
console.log("body: " + body);
