class Animal {
  constructor() {
    this.runable = true;
    this.breathable = true;
  }
}

class Human extends Animal {
  nameable = true;
  constructor(myName) {
    super();
    this.name = myName;
  }
}

class Developer extends Human {
  codeable = true;
  constructor(developerName) {
    super(developerName);
    this.hiredable = true;
  }
  hi(name) {
    alert(
      JSON.stringify(
        {
          message: `Hi \${name}, I am \${this.name}`,
          name: this.name, // inherit from Human
          nameable: this.nameable, // inherit from Human
          hiredable: this.hiredable, // get from Developer
          codeable: this.codeable, // get from Developer
          runable: this.runable, // inherit from Animal
          breathable: this.breathable // inherit from Animal
        },
        null,
        2
      )
    );
  }
}

const axetroy = new Developer("Axetroy");

axetroy.hi("friend");
