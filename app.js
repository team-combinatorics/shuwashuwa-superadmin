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

Vue.component('cfilter',{
	template:'#filter-template',
	model:{
		prop:"enabled",
		event:'change'
	},
	props:{
		enabled:Boolean
	},
	data:()=>({cenabled:false})
});

function dateTime(date,time){
	return dateFns.parse(`${date}T${time}`);
}
function toDate(date){
	return dateFns.format(date,'YYYY-MM-DD');
}
function toTime(date){
	return dateFns.format(date,'HH:mm');
}
function toDateTime(date){
	return dateFns.format(date,'YYYY-MM-DD HH:mm:ss');
}

function encodeMin(min){
	let a=min.split(':').map(parseFloat);
	return a[0]*60+a[1];
}
function decodeMin(min){
	let hrs=(min/60)|0;
	let mins=min%60;
	let pad=(x)=>`00${x}`.slice(-2);
	return `${pad(hrs)}:${pad(mins)}`;
}

function objectMap(data,mapp,ind){
	if((typeof data)!='object')
		return mapp(data,ind);
	if(data instanceof Array){
		return data.map((val,ind)=>objectMap(val,mapp,ind));
	}else{
		let dict={};
		for(let r in data)
			dict[r]=objectMap(data[r],mapp,r);
		return dict;
	}
}

let globalQR="";

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
	generateFilter(){
		let dict=new FormData();
		if(this.elem.startEnabled)
			dict.append('startLower',toDateTime(dateTime(this.elem.startingDate,this.elem.startingTime)));
		if(this.elem.endEnabled)
			dict.append('endUpper',toDateTime(dateTime(this.elem.endingDate,this.elem.endingTime)));
		if(this.elem.onGoing) {
			let now=new Date();
			dict.append('startUpper',toDateTime(now));
			dict.append('endLower',toDateTime(now));
		}
		return dict;
	}
	parseActivity(reqDat){
		let parseFn=(dat)=>{
			let start=dat.startTime.split(' ');
			let end=dat.endTime.split(' ');
			let t1=dateTime(start[0],start[1]);
			let t2=dateTime(end[0],end[1]);
			dat.startTime=toTime(t1);
			dat.date=toDate(t1);
			dat.endTime=toTime(t2);
			dat.timeSlots=[];
			return dat;
		};
		return reqDat.map(parseFn);
	}
	refreshA(){
		let dict=this.generateFilter();
		this.agent.Send("api/activity","GET",dict,(req)=>{
			this.elem.acts=this.parseActivity(req.data);
			this.selAct(this.elem.selectedAct);
		});
	}
	parseSlots(data){
		return data.map((r)=>({
			startTime:r.startTime.slice(11,16),
			endTime:r.endTime.slice(11,16)
		}));
	}
	selAct(id){
		let dict=new FormData();
		dict.append('activity',id);
		if(id>=0) {
			this.agent.Send("api/activity/slot", "GET", dict, (req) => {
				this.elem.selectedAct = id;
				this.elem.actSel.timeSlots = this.parseSlots(req.data);
			});
		}else this.elem.selectedAct=id;
	}
	deleteAct(id){
		let dict=new FormData();
		dict.append('activityId',id);
		this.agent.Send("api/super/activity","DELETE",dict,()=>{
			this.elem.selectedAct=-1;
			this.refreshA();
		});
	}
	submitAct() {
		this.elem.slotSort();
		let date = this.elem.actSel.date;
		let compose = (time) => `${date} ${time}:00`;
		let dict = objectMap(this.elem.actSel,(val,key)=>{
			if(key=='imgData')
				return "";
			if((key=='startTime') || (key=='endTime'))
				return compose(val);
			else
				return val;
		});
		console.log(dict);
		dict.timeSlots=dict.timeSlots.map((val,ind)=>{
			val.timeSlot=ind;
			return val;
		});
		let met='POST';
		if(this.elem.selectedAct!==-2){
			/// post
			met='PATCH';
			dict.activityId=this.elem.selectedAct;
		}
		this.agent.Send("api/super/activity",met,dict,()=>{
			this.refreshA();
		});
	}
	constructor(selector, data, agent, msgOverlay){
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
		this.ctfDict2={
			id:"id",
			name:"activityName",
			loca:"location",
			date:"date",
			start:"startTime",
			end:"endTime"
		};
		this.ctfHeaderDict2={
			id:"编号",
			name:"名称",
			loca:"地点",
			date:"日期",
			start:"起始时间",
			end:"终止时间"
		};
		this.typeDict2={
			id:"number",
			name:"text",
			loca:"text",
			date:"date",
			start:"time",
			end:"time"
		};
		let tempo={};
		for(let name in this.ctfDict)
			tempo[this.ctfDict[name]]=name;
		tempo['userid']=0;
		let tempoAct={
			"id": 0,
			"activityName": "",
			"date":"1926-08-17",
			"startTime": "11:45",
			"endTime": "11:45",
			"location": "",
			"timeSlots": [
				{
					"endTime": "11:45",
					"startTime": "11:45",
					"timeSlot": 0
				}
			]
		};
		let now=new Date();
		let nowdate=toDate(now);
		let nowtime=toTime(now);
		this.elem=new Vue({
			el:selector,
			data:{
				showTab:0,
				tabs:{
					0:"管理员",
					1:"活动"
				},
				admins:this.admins,
				ctfDict:this.ctfDict,
				ctfDict2:this.ctfDict2,
				ctfHeaderDict2:this.ctfHeaderDict2,
				typeDict2:this.typeDict2,
				tempo:tempo,
				showTempo:false,
				showTempo2:false,
				acts:[],
				selectedAct:-1,
				tempoAct:tempoAct,
				startEnabled:false,
				endEnabled:false,
				onGoing:false,
				startingDate:nowdate,
				endingDate:nowdate,
				startingTime:nowtime,
				endingTime:nowtime,
				splitRegion:30,
				tempoSlot:{'startTime':'12:00','endTime':'12:00'}
			},
			computed:{
				actSelID:function(){
					if(this.selectedAct===-2){
						return -2;
					}else if(this.selectedAct===-1){
						return -1;
					}else {
						for (let i = 0; i < this.acts.length;++i){
							if(this.acts[i].id===this.selectedAct)
								return i;
						}
						return -1;
					}
				},
				actSel:{
					set:function(p){
						if(this.actSelID===-2) this.tempoAct=p;
						else if(this.actSelID===-1){/*Do nothing*/}
						else this.acts[this.actSelID]=p;
					},
					get:function(){
						if(this.actSelID>=0) return this.acts[this.actSelID];
						else return this.tempoAct;
					}
				}
			},
			methods:{
				deleteAdmin:(admin)=>this.delete(admin),
				addAdmin:(data)=>this.add(data),
				updAdmin:(admin)=>this.update(admin),
				deleteAct:()=>{
					this.deleteAct(this.elem.selectedAct);
				},
				submitAct:()=>this.submitAct(),
				refreshActivities:()=>this.refreshA(),
				selAct:(act)=>this.selAct(act),
				slotDel:function(ind){
					this.actSel.timeSlots.splice(ind,1);
				},
				slotAdd:function(slot){
					this.actSel.timeSlots.push(slot);
				},
				slotSplit:function(){
					let slots=[];
					let startTime=encodeMin(this.actSel.startTime);
					let endTime=encodeMin(this.actSel.endTime);
					let splitRegion=parseFloat(this.splitRegion);
					if(startTime==endTime)slots=[{
						startTime:this.actSel.startTime,
						endTime:this.actSel.endTime
					}];else{
						for(let a=startTime;a<endTime;a+=splitRegion){
							slots.push({
								'startTime':decodeMin(a),
								'endTime':decodeMin(Math.min(endTime,a+splitRegion))
							});
							console.log('split');
						}
					}
					this.actSel.timeSlots=slots;
				},
				slotSort:function(){
					this.actSel.timeSlots=this.actSel.timeSlots.sort((a,b)=>{
						if(a.startTime<b.startTime) return -1;
						if(a.startTime===b.startTime) return 0;
						return 1;
					});
				},
				reqQR:function(ind){
					if(this.actSel.imgData){
						msgOverlay.show(`<img src="data:image/jpg;base64,${this.actSel.imgData}"/>`,'inform');
					}else {
						let dict = new FormData();
						dict.append('activityId', ind);
						agent.Send('api/super/QRCode', 'GET', dict, (req) => {
							this.actSel.imgData=req.data;
							msgOverlay.show(`<img src="data:image/jpg;base64,${req.data}"/>`, 'inform');
						});
					}
				}
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
			this.adminList=new AdminList("#Tabs",req.data,this.agent,this.msgoverlay);
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
