const fs = require('fs');
const readline = require('readline');

log = function(string){
  // console.log(string);
}

function trim(string){
  return string.split('').filter(c => c !== ' ').join('');
}

function printModel(model){
  log('\n\n.:: MODEL STRUCTURE ::.');
  log('States: ');
  model.states.forEach(function(state){
    log(`\t${state.name}: ${state.labels.join(', ')}`);
  })
  log('Transitions: ');
  model.states.forEach(function(state){
    log(`\t${state.name} -> ${state.transitions.map(s => s.name).join(', ')}`);
  });
  log(`Initial State: ${model.initialState.name}`)
  log(`Spec: ${model.spec.operator} ${model.spec.p} ${model.spec.q}`);
}

function parseVariable(line, model){
  log(`parsing variable from: ${line}`);
  const match = /state ?: ?{([\w\d ,]*)} ?;/.exec(line);
  if (!match[1]) throw new Error('variable line cannot be parsed');

  model.states = match[1].split(',').map(trim).map(function(name){
    return {
      name,
      labels: name.match(/.{2}/g),
      transitions: [],
      satisfies: function(proposition){
        if (proposition.startsWith('!'))
          return !this.satisfies(proposition.slice(1));
        return this.labels.some(l => l === proposition);
      }
    }
  });
}

function parseInitialization(line, model){
  log(`parsing initialization from: ${line}`);
  const match = /init\(state\) ?:= ?([\w\d]*) ?;/.exec(line);
  if (!match[1]) throw new Error('initialization cannot be parsed');

  model.initialState = model.states.find(s => s.name === match[1]);
}

function parseTransition(line, model){
  log(`parsing transition from: ${line}`);
  let match;
  if (line.startsWith('next')) {
    match = /next\(state\) ?:=/.exec(line);
    if (!match[0]) throw new Error('transition is not well defined');
    return;
  }
  if (line.startsWith('case')) return;
  if (line.startsWith('1')) return;
  
  match = /\(?state ?= ?([\w\d]*)\)? ?: ?{?([\w\d ,]*)}? ?;/.exec(line);
  if (!match[1] || !match[2]) throw new Error('transition cannot be parsed');

  const from = model.states.find(s => s.name === match[1]);
  match[2].split(',').map(trim).forEach(function(name){
    const to = model.states.find(s => s.name === name);
    from.transitions.push(to);
  });
}

function parseSpec(line, model){
  log(`parsing ctlspec from: ${line}`);
  const match = /CTLSPEC (EX|AX|EF|AF|EG|AG|E|A) ([\w\d !\[\]]*)/.exec(line);
  if (!match[1] || !match[2]) throw new Error('ctlspec cannot be parsed');

  if (match[1].length === 2) {
    if (!/!?[\w\d]*/.test(match[2])) throw new Error('proposition cannot be parsed');
    model.spec.operator = match[1];
    model.spec.p = match[2];
  } else {
    const submatch = /\[ ?(!?[\w\d]*) ?U ?(!?[\w\d]*) ?\]/.exec(match[2])
    if (!submatch[1] || !submatch[2]) throw new Error('proposition cannot be parsed');
    model.spec.operator = match[1] + 'U';
    model.spec.p = submatch[1];
    model.spec.q = submatch[2];
  }
}

function parse(line, model){
  switch (model.parsingState) {
    case 'NOT_STARTED': 
      if (!line.startsWith('MODULE')) throw new Error('the input should start with module keyword');
      model.parsingState = 'VARIABLES';
      return;
    case 'VARIABLES':
      if (line.startsWith('VAR')) return;
      if (line.startsWith('ASSIGN')) {
        if (!model.states) throw new Error('no variable is defined');
        model.parsingState = 'ASSIGNMENTS';
        return;
      }
      return parseVariable(line, model);
    case 'ASSIGNMENTS':
      if (line.startsWith('init')) return parseInitialization(line, model);
      if (line.startsWith('next')) {
        model.parsingState = 'TRANSITION';
        return parseTransition(line, model);
      }
      if (line.startsWith('CTLSPEC')) {
        return parseSpec(line, model);
      }
      return;
    case 'TRANSITION':
      if (line.startsWith('esac;')) {
        model.parsingState = 'ASSIGNMENTS';
        return;
      }
      return parseTransition(line, model);
  }
}

exports.parse = function(file, callback){
  const io = readline.createInterface({
    input: fs.createReadStream(file)
  });

  const model = {
    parsingState: 'NOT_STARTED',
    initialState: null,
    states: [],
    spec: {
      operator: null,
      p: null,
      q: null
    }
  };

  io.on('line', function(line){
    parse(line, model);
  });

  io.on('close', function(){
    printModel(model);
    callback(model);
  });
};

