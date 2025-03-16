const readline = require('readline');
const crypto = require('crypto');
const inquirer = require('inquirer');
const AsciiTable = require('ascii-table');
const chalk = require('chalk');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const args = process.argv.slice(2);

class ProbabilityTable {
  constructor(dices) {
    this.dices = dices;
  }

  createTable() {
    const probability = [];

    this.dices.map((dice) => {
      const compareResults = this.dices.map((comparableDice) => {
        if (dice === comparableDice) {
          return '-';
        }
        return this.countWins(dice.sides, comparableDice.sides);
      });

      probability.push(compareResults);
    });

    const helpTable = new AsciiTable('Probability of the win fоr the user:');
    helpTable
      .setHeading('User dice v', ...this.dices.map((dice) => dice.sides));

    probability.map((probability, index) => {
      helpTable.addRow(`${this.dices[index].sides}`, ...probability.flat());
    });
    console.log(helpTable.toString());
  
  }

  countWins(a, b) {
    const totalCases = a.length * b.length
    const winningCases = a.flatMap(x => b.map(y => x > y)).filter(x => x).length;
    return (winningCases / totalCases).toFixed(4)
  }
}

class Menu {
  constructor(menuElements, dices) {
    this.menuElements = menuElements;
    this.menuItems = [...this.menuElements, 'exit', 'help'];
    this.dices = dices;
  }

  async showMenu(message) {
    let selectedItem;
    let validSelection = false;

    while (!validSelection) {
      rl.pause();
      const response = await inquirer.prompt([{
        type: 'list',
        name: 'selectedItem',
        message: message || 'Select an option:',
        choices: this.menuItems
      }]);

      selectedItem = response.selectedItem;
      rl.resume();

      if (selectedItem === 'help') {
        this.help();
        console.log(chalk.blue("\nPlease make a selection from the menu:"));
      } else if (selectedItem === 'exit') {
        this.exit();
        return null;
      } else {
        validSelection = true;
      }
    }

    return selectedItem;
  }

  exit() {
    rl.close();
    process.exit(0);
  }

  help() {
     console.log(chalk.blue(`
    Welcome to the Non-Transitive Dice Game! 🎲           
    This is not your typical dice game! Here, different dice have       
    unique values, and no single die is always the best. You and the    
    computer will each choose a die and roll to see who wins.                                                                         
    But there's a twist—every roll is provably fair! Before rolling,    
    the computer generates a secret number and shares a secure HMAC.    
    You pick your own number, and only then does the computer reveal    
    its secret key. This lets you verify that the game is 100% honest!                                                                     
    Need help? Below is a probability table to see how each die         
    compares to the others.                                                                                                               
    Ready to test your luck and strategy? Let's roll! 🚀               
    
      `))

      
    const table = new ProbabilityTable(this.dices);
    table.createTable();
  }

  async promptForDiceSelection(availableDices, message) {
    const dicesForMenu = availableDices.map((dice) => JSON.stringify(dice.sides));
    const diceMenu = new Menu(dicesForMenu, this.dices);

    const selectedDice = await diceMenu.showMenu(message);
    if (!selectedDice) return null;

    return availableDices.find((dice) => JSON.stringify(dice.sides) === selectedDice);
  }

  async promptForNumber(range, message) {
    const numberMenu = new Menu([...Array(range).keys()].map(String), this.dices);
    return await numberMenu.showMenu(message);
  }
}

class Dice {
  constructor(sides) {
    this.sides = sides.split(',').map(Number);
    this.status = 'available';
  }

  select() {
    this.status = 'selected';
    return this;
  }
}

class RandomValues {
  constructor(diapason) {
    this.randomKey = crypto.randomBytes(32).toString('hex');
    this.randomBit = crypto.randomInt(diapason);
    this.hmac = this.generateHMAC();
  }

  generateHMAC() {
    const hmac = crypto.createHmac('sha3-256', this.randomKey)
      .update(this.randomKey.toString())
      .digest('hex');
    return hmac;
  }
}

class GamePlayer {
  constructor() {
    this.chosenDice = null;
    this.rollResult = null;
  }

  setRollResult(fairNumber) {
    this.rollResult = this.chosenDice.sides[fairNumber];
  }
}

class PC extends GamePlayer {
  chooseDice(dices, turnOrder) {
    const randomDiceIndex = crypto.randomInt(dices.length);
    this.chosenDice = dices[randomDiceIndex].select();
    const message = turnOrder ?
      `I choose the dice ${this.chosenDice.sides}` :
      `I make the first move and choose the ${this.chosenDice.sides} dice.`;
    console.log(chalk.magenta(message));
    return this.chosenDice;
  }
}

class Player extends GamePlayer {
  constructor(allDices) {
    super();
    this.allDices = allDices;
  }

  async chooseDice(availableDices, mainMenu) {
    const dice = await mainMenu.promptForDiceSelection(
      availableDices,
      'Your time to choose the dice'
    );

    if (!dice) return null;

    this.chosenDice = dice.select();
    console.log(chalk.magenta(`You choose ${this.chosenDice.sides} dice`));
    return this.chosenDice;
  }
}

class Game {
  constructor(...restArgs) {
    this.diceArgs = restArgs;
    this.dices = [];
    this.invalidDices = [];
    this.hasError = false;
    this.turnOrder = null;
    this.PCPlayer = new PC();
    this.mainMenu = new Menu([], this.dices);
    this.player = new Player(this.dices);
  }

  checkArguments() {
    const args = this.diceArgs;

    if (args.length < 3) {
      console.log(chalk.yellow('Error: at least 3 dice arguments are required!\n'));
      this.hasError = true;
      return false;
    }
    for (let i = 0; i < args.length; i++) {
      const dice = args[i];
      const sides = dice.split(',');

      if (sides.length !== 6) {
        console.log(chalk.yellow(`Error: dice #${i + 1} (${dice}) must have exactly 6 sides!\n`));
        this.invalidDices.push(i);
        this.hasError = true;
      }


      for (let j = 0; j < sides.length; j++) {
        const side = sides[j];
        if (isNaN(parseInt(side)) || parseInt(side).toString() !== side) {
          console.log(chalk.yellow(`Error: dice #${i + 1} (${dice}) contains non-integer value '${side}' at position ${j + 1}!\n`));
          if (!this.invalidDices.includes(i)) {
            this.invalidDices.push(i);
          }
          this.hasError = true;
        }
      }
    }

    if (!this.hasError) {
      this.dices = args.map((sides) => new Dice(sides));
      this.mainMenu = new Menu([], this.dices);
      this.player = new Player(this.dices);
    }

    return !this.hasError;
  }

  async start() {
    if (!this.checkArguments()) {
      process.exit(1);
    }

    await this.decideTurnOrder();
    await this.chooseDice();

    if (this.turnOrder === 0) {
      await this.roll(this.PCPlayer, 'My');
      await this.roll(this.player, 'Your');
    } else {
      await this.roll(this.player, 'Your');
      await this.roll(this.PCPlayer, 'My');
    }

    await this.determineWinner();
  }

  async decideTurnOrder() {
    const pcRandomValue = new RandomValues(2);
    console.log(chalk.magenta(`Let's determine who makes the first move.`));
    console.log(chalk.magenta(`I selected a random value in the range 0..1 (HMAC=${pcRandomValue.hmac})`));

    const numberMenu = new Menu(['0', '1'], this.dices);
    const selectedItem = await numberMenu.showMenu('Try to guess my selection.');
    if (selectedItem === null) return;

    this.turnOrder = selectedItem == pcRandomValue.randomBit ? 1 : 0;

    console.log(chalk.blue(`Your selection: ${selectedItem}`));
    console.log(chalk.blue(`My selection: ${pcRandomValue.randomBit}`));
    console.log(chalk.blue(`(KEY=${pcRandomValue.randomKey})`));
  }

  async chooseDice() {
    const players = this.turnOrder === 0
      ? [this.PCPlayer, this.player]
      : [this.player, this.PCPlayer];

    for (const player of players) {
      const availableDices = this.dices.filter((dice) => dice.status === 'available');
      if (player === this.PCPlayer) {
        player.chooseDice(availableDices, this.turnOrder);
      } else {
        const result = await player.chooseDice(availableDices, this.mainMenu);
        if (!result) return;
      }
    }
  }

  async roll(player, startString) {
    const pcRoll = new RandomValues(6);
    console.log(chalk.blue(`It's time for my roll`));
    console.log(chalk.blue(`I selected a random value in the range 0..5 (HMAC=${pcRoll.hmac})`));

    const playerSelection = await this.mainMenu.promptForNumber(6, 'Add your number modulo 6');
    if (playerSelection === null) return;

    const fairNumber = (pcRoll.randomBit + parseInt(playerSelection)) % 6;
    console.log(chalk.magenta(`Your choice is ${playerSelection}`));
    console.log(chalk.magenta(`My number is ${pcRoll.randomBit} (KEY=${pcRoll.randomKey}).`));
    console.log(chalk.magenta(`The fair number is ${pcRoll.randomBit} + ${playerSelection} = ${fairNumber} (mod 6).`));

    player.setRollResult(fairNumber);
    console.log(chalk.magenta(`${startString} Roll Result is ${player.rollResult}`));
  }

  async determineWinner() {
    if (this.PCPlayer.rollResult > this.player.rollResult) {
      console.log(chalk.green(`I win (${this.PCPlayer.rollResult} > ${this.player.rollResult})!`));
    } else if (this.PCPlayer.rollResult < this.player.rollResult) {
      console.log(chalk.green(`You win (${this.player.rollResult} > ${this.PCPlayer.rollResult})!`));
    } else {
      console.log(chalk.green(`It's a tie (${this.PCPlayer.rollResult} = ${this.player.rollResult})!`));
    }
    process.exit(0)
  }
}

const myDiceGame = new Game(...args);
myDiceGame.start();