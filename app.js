class MsgOverlay{
	overlay;
	box;
	constructor(OverlayID, MessageBox) {
		this.overlay=document.getElementById(OverlayID);
		this.box=document.getElementById(MessageBox);
		this.overlay.addEventListener("click",()=>{this.clicked()});
	}
	clicked(){ this.overlay.classList.add('invisible'); }
	show(HTMLText,classList){
		/// class manip; classList is actually optional
		let mutClassList=(classList||"").split(' ');
		this.box.classList.remove(...this.box.classList);
		this.box.classList.add(...mutClassList);
		/// message loading
		this.box.innerHTML=HTMLText;
		/// show overlay
		this.overlay.classList.remove('invisible');
	}
}

class Form{
	form;
	constructor(form) {
		this.form=document.getElementById(form);
	}
	show(){this.form.classList.remove('invisible');}
	hide(){this.form.classList.add('invisible');}
}
class LoginForm extends Form{
	name;
	pass;
	btn;
	callback=()=>{};
	constructor(form,namep,passp,btn) {
		super(form);
		this.name=document.getElementById(namep);
		this.pass=document.getElementById(passp);
		this.btn=document.getElementById(btn);
		this.btn.addEventListener("click",()=>{
			let nameStr=this.name.value;
			let passStr=this.pass.value;
			console.log(`name:${nameStr};pass:${passStr};`);
			this.callback(nameStr,passStr);
		});
	}
}
class ManagerForm extends Form{
	constructor(page) {
		super(page);
	}
}

class AdminList{
	admins;
	adminsOld;
	elem;
	agent;
	validate(admin, cb){
		/// do data validation
	}
	delete(admin){
		let adminR=new FormData();
		adminR.append("userID",admin.userid);
		this.agent.Send("api/super/admin","DELETE",adminR,()=>this.flush());
	}
	add(data){
		this.agent.Send("api/super/admin","POST",data,()=>this.flush());
	}
	update(admin){
		this.agent.Send("api/super/admin","PATCH",admin,()=>this.flush());
	}
	saveHistory(){
		this.adminsOld=_.cloneDeep(this.admins);
	}
	recoverHistory(){
		this.elem.admins=_.cloneDeep(this.adminsOld);
	}
	flush(){
		this.agent.Send("api/super/admin/list","GET",null,(req)=>{
			let data=_.cloneDeep(req.data).sort((a,b)=>a.userid-b.userid);
			this.elem.admins=data;
			this.saveHistory();
		});
	}
	constructor(selector, data, agent){
		this.agent=agent;
		this.admins=_.cloneDeep(data).sort((a,b)=>a.userid-b.userid);
		this.saveHistory();
		this.ctfDict={
			id:"userid",
			name:"userName",
			phone:"phoneNumber",
			email:"email",
			ident:"identity",
			depart:"department",
			stuid:"studentId"
		};
		let tempo={};
		for(let name in this.ctfDict)
			tempo[this.ctfDict[name]]=name;
		tempo['userid']=0;
		this.elem=new Vue({
			el:selector,
			data:{
				admins:this.admins,
				ctfDict:this.ctfDict,
				tempo:tempo,
				showTempo:false
			},
			methods:{
				deleteAdmin:(admin)=>this.delete(admin),
				addAdmin:(data)=>this.add(data),
				updAdmin:(admin)=>this.update(admin)
			}
		});
	}
}

class StatusWindow{
	elem;
	agent;
	passwd;
	msgov;
	vtimeout;
	changePasswd(oldPass,newPass){
		let cform={
			oldPassword:oldPass,
			newPassword:newPass
		};
		this.agent.Send("api/super/change","PUT",new HeaderDict(cform),(req)=>{
			this.passwd=newPass;
			this.msgov.show("密码修改大成功","success");
		});
	}
	clear(days){
		let a=new FormData();
		a.append("days",days);
		this.agent.Send("api/super/cache","DELETE",a,(req)=>{
			this.msgov.show("清除缓存大成功","success");
			clearTimeout(this.vtimeout);
			this.refreshImagecount();
		});
	}
	refreshImagecount(){
		this.agent.Send("api/super/cache","GET",null,(req)=> {
			this.elem.count=req.data;
			this.vtimeout=setTimeout(()=>this.refreshImagecount(),10000);
		});
	}
	constructor(selector,agent,msgov) {
		this.agent=agent;
		this.msgov=msgov;
		this.passwd=document.getElementById("password").value;
		agent.Send("api/super/cache","GET",null,(req)=>{
			this.elem=new Vue({
				el:selector,
				data:{
					count:req.data,
					pop:true,
					changedPasswd:"",
					clearDays:15,
					delOn:false,
					hovered:false
				},
				methods:{
					change:(passwd)=>this.changePasswd(this.passwd,passwd),
					clear:(days)=>this.clear(days)
				}
			});
			this.vtimeout=setTimeout(()=>this.refreshImagecount(),10000);
		});
	}
}

class App{
	agent;
	msgoverlay;
	loginform;
	mgrform;
	adminList;
	status;
	get viab(){return this.agent.viab;}
	loginSuccess(){
		this.loginform.hide();
		this.mgrform.show();
		this.agent.fail=(req)=>this.msgoverlay.show(req.message,"error");
		this.agent.Send("api/super/admin/list","GET",null,(req)=>{
			this.adminList=new AdminList("#AdminList",req.data,this.agent);
		});
		this.status=new StatusWindow("#StatusWindow",this.agent,this.msgoverlay);
	}
	constructor() {
		this.msgoverlay=new MsgOverlay('MessageOverlay','Message');
		this.loginform=new LoginForm('LoginForm','username','password','login_button');
		this.mgrform=new ManagerForm('ManagementPage');
		this.loginform.callback=(name,pass)=>{
			this.agent=new RequestAgent(name,pass,(req,code)=>{
				if(code===code_success)
					this.loginSuccess();
				else {
					this.mgrform.hide();
					this.loginform.show();
					this.msgoverlay.show(req.message,"error");
				}
			});
		}
	}
}