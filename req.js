const BaseURL="http://shuwa.com/req";
const code_success=200;
const code_Unauthorized=401;
const code_Forbidden=403;
const code_notFound=404;
const code_loginError=40011;

const REQ=(str)=>`${BaseURL}/${str}`;

function fdSerial(fd){
	return new URLSearchParams(fd).toString();
}

function ListenerSnapshot(Success,Failure,LoginHandler,Agent,xhrObj){
	return function(){
		let req=xhrObj.response;
		let code = req.code;
		if(code===code_loginError || code===code_Unauthorized) {
			LoginHandler(req, code);
			Agent.viab=false;
		}else {
			if(code===code_success) Success(req);
			else Failure(req);
		}
	};
}

class HeaderDict{
	dict;
	constructor(dict) {
		this.dict=_.cloneDeep(dict);
	}
}

class RequestAgent{
	cb;
	xhrObj;
	tok;
	failure;
	logH;
	viab;
	constructor(userName, password, loginHandler) {
		console.log("generate request agent");
		console.log(userName,password);
		this.viab=false;
		/// set up login handler
		this.logH=loginHandler;
		/// set up xhr object
		this.xhrObj=new XMLHttpRequest();
		this.xhrObj.onload=()=>this.Listener();
		this.xhrObj.responseType='json';
		/// set up login post
		let LoginDict=new FormData();
		LoginDict.set('userName',userName);
		LoginDict.set('password',password);
		let LoginSer=fdSerial(LoginDict);
		console.log(LoginSer);
		let registerToken=(resp)=>{
			/// use token
			this.token=resp.data;
			/// login success
			loginHandler(resp,code_success);
		};
		this.cb=registerToken;
		this.failure=(resp)=>loginHandler(resp,resp.code);
		/// send login request
		this.xhrObj.open("GET",REQ('api/super/login?'+LoginSer));
		this.xhrObj.send(LoginDict);
	}

	Listener(){
		/// wrapper
		console.log(this.xhrObj.response);
		let response = this.xhrObj.response;
		let code = this.xhrObj.response.code;
		/// take care of login error
		if(code===code_loginError || code===code_Unauthorized) {
			this.logH(response, code);
			this.viab=false; /// disable viability
		}else {
			/// do callback when success
			if(code===code_success)
				this.cb(response);
			else
				this.failure(response);
		}
	}

	set callback(fn){ if(this.viab) this.cb=fn; }
	get callback(){ return this.cb; }
	set fail(fn){ if(this.viab) this.failure=fn; }
	get fail(){ return this.failure; }

	set token(str){
		this.viab=true;
		console.log(`set user token as ${str}, enabling object viability`);
		this.tok=str;
	}

	Send(URL, Method, Data, Callback) {
		if (!this.viab) return;
		let xhrObj=new XMLHttpRequest(); /// Create a new XHR object every time
		console.log(xhrObj);
		let cbb=ListenerSnapshot(Callback||this.cb,this.failure,this.logH,this,xhrObj);
		xhrObj.responseType='json';
		xhrObj.onload=cbb;
		if (Data instanceof FormData) {
			/// Serialize as urlform
			let Target = REQ(URL);
			if (Data) Target += '?' + fdSerial(Data);
			xhrObj.open(Method, Target);
		} else xhrObj.open(Method, REQ(URL));
		xhrObj.setRequestHeader("Token", this.tok);
		if (Data && !(Data instanceof FormData)){
			if(Data instanceof HeaderDict){
				for(let name in Data.dict)
					xhrObj.setRequestHeader(name,Data.dict[name]);
				xhrObj.send();
			}else {
				xhrObj.setRequestHeader('content-type', 'application/json');
				xhrObj.send(JSON.stringify(Data));
			}
		} else xhrObj.send();
	}
}