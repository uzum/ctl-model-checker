// author: anil.uzumcuoglu

// a CTL model checker for the formulas of the form E [ p U q ]

const parser = require('./parser');

parser.parse(process.argv[2], function(model){
  // initial marking: label any s with E(p U q) if s is already labeled with q
  model.states.forEach(function(state){
    if (state.satisfies(model.spec.q)) state.labels.push('epuq');
  });

  // repeated marking: label any s with E(p U q) if 
  // 1- s is already labeled with p
  // 2- at least one of its successor states is already labeled with E(p U q)
  let dirty = true;
  while(dirty) {
    dirty = false;
    model.states.forEach(function(state){
      if (state.satisfies('epuq')) return;

      if (state.satisfies(model.spec.p) && state.transitions.some(s => s.satisfies('epuq'))) {
        state.labels.push('epuq');
        dirty = true;
      }
    });
  }

  // result: collect the states that satisfies E(p U q)
  console.log('\n> Satisfying states:');
  console.log(model.states.filter(state => state.satisfies('epuq')).map(s => s.name));
});