const {models} = require('./model');
const {log, biglog, errorlog, colorize} = require("./out");
const Sequelize = require('sequelize');

exports.helpCmd = rl => {
    log("Comandos:");
    log("  h|help - Muestra esta ayuda.");
    log("  list - Listar los quizzes existentes.");
    log("  show <id> - Muestra la pregunta y la respuesta del quiz indicado.");
    log("  add - Añadir un nuevo quiz interactivamente.");
    log("  delete <id> - Borrar el quiz idicado.");
    log("  edit <id> - Editar el quiz indicado.");
    log("  test <id> - Probar el quiz indicado.");
    log("  p|play - Jugar a preguntar aleatoriamente todos los quizzes.");
    log("  credits - Créditos.");
    log("  q|quit - Salir del programa.");
    rl.prompt();
};

const makeQuestion = (rl, text) => {
  return new Sequelize.Promise((resolve, reject) => {
    rl.question(colorize(text, 'red'), answer => {
      resolve(answer.trim());
    });
  });
};

exports.addCmd = rl => {
    makeQuestion(rl, ' Introduzca una pregunta: ')
    .then(q => {
      return makeQuestion(rl, ' Introduzca la respuesta ')
      .then(a => {
        return {question: q, answer: a};
      });
    })
    .then(quiz => {
      return models.quiz.create(quiz);
    })
    .then(quiz => {
      log(` ${colorize('Se ha añadido', 'magenta')}: ${quiz.question} ${colorize('=>', 'magenta')} $${quiz.answer}`);
    })
    .catch(Sequelize.ValidationError, error => {
      errorlog('El quiz es erroneo:');
      error.errors.forEach(({message}) => errorlog(message));
    })
    .catch(error => {
      errorlog(error.message);
    })
    .then(() => {
      rl.prompt();
    });
};

exports.listCmd = rl => {
    models.quiz.findAll()
    .each(quiz => {
        log(` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
    })
    .catch(error => {
      errorlog(error.message);
    })
    .then(() => {
      rl.prompt();
    });
};

const validateId = id => {
  return new Sequelize.Promise((resolve, reject) => {
    if (typeof id === "undefined") {
      reject(new Error(`Falta el parámetro <id>.`));
    } else {
      id = parseInt(id);
      if (Number.isNaN(id)) {
        reject(new Error(`El valor del parámetro <id> no es un número.`));
      } else {
        resolve(id);
      }
    }
  });
};

exports.showCmd = (rl, id) => {
    validateId(id)
    .then(id => models.quiz.findById(id))
    .then(quiz => {
      if (!quiz) {
        throw new Error(`No existe un quiz asociado al id=${id}.`);
      }
      log(` [${colorize(quiz.id, 'magenta')}]: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}.`);
    })
    .catch(error => {
      errorlog(error.message);
    })
    .then(() => {
      rl.prompt();
    });
};

exports.testCmd = (rl, id) => {
    validateId(id)
   .then(id => models.quiz.findById(id))
   .then(quiz => {
     if (!quiz) {
       throw new Error(`No existe un quiz asociado al id=${id}.`)
     }
     return makeQuestion(rl, ` ¿${quiz.question}?: `)
      .then(answ => {
        quest = quiz.answer.toLowerCase().trim()
        ans = answ.toLowerCase().trim()
        if (ans === quest) {
            log(`Su respuesta es correcta:`);
            biglog(`CORRECTO`, 'green');
        } else {
            log(`Su respuesta es incorrecta:`);
            biglog(`INCORRECTO`, 'red');
        }
      })
   })
   .catch(Sequelize.ValidationError, error => {
      errorlog('El quiz es erroneo:');
      error.errors.forEach(({message}) => errorlog(message));
   })
   .catch(error => {
      errorlog(error.message);
   })
   .then(() => {
      rl.prompt();
   });
};

exports.playCmd = rl => {
      let score = 0;
      let toBeResolved = [];
      let i=0;
      for(i ; i<models.quiz.count(); i++){
         toBeResolved[i]=i;
      }
      const playOne = () => {
        return Sequelize.Promise.resolve()
            .then(()=>{
                if(toBeResolved.length === 0){
                    log(`No hay mas preguntas`);
                    log(`${score}`);
                    return;
                }
                let id = Math.floor(Math.random() * toBeResolved.length);
                let quiz = toBeResolved[id];
                toBeResolved.splice(id,1);
                return makeQuestion(rl,`¿${quiz.question}?: `)
                    .then(answ => {
                        quest = quiz.answer.toLowerCase().trim()
                        ans = answ.toLowerCase().trim()
                        if(ans === quest){
                            score++;
                            log(`CORRECTO - Lleva ${score} aciertos.`);
                            return playOne();
                        }else{
                            log(`INCORRECTO`);
                            log(`Fin del examen. Aciertos:`);
                            log(`${score}`);
                            return;
                        }

                    })
            })};
    	models.quiz.findAll({raw: true}) 
    	.then(quizzes => {
    			toBeResolved = quizzes;
      })
      .then(() => {
    		 return playOne(); 
      })
     .catch(error => {
        errorlog(error.message);
     })
     .then(() => {
        rl.prompt();
     });
};

exports.deleteCmd = (rl, id) => {
    validateId(id)
    .then(id => models.quiz.destroy({where: {id}}))
    .catch(error => {
      errorlog(error.message);
    })
    .then(() => {
      rl.prompt();
    });
};

exports.editCmd = (rl, id) => {
   validateId(id)
   .then(id => models.quiz.findById(id))
   .then(quiz => {
     if (!quiz) {
       throw new Error(`No existe un quiz asociado al id=${id}.`);
     }
     process.stdout.isTTY && setTimeout(() => {rl.write(quiz.question)}, 0);
     return makeQuestion(rl, ' Introduzca la pregunta: ')
     .then(q => {
       process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)}, 0);
       return makeQuestion(rl, ' Introduzca la respuesta ')
       .then(a => {
         quiz.question = q;
         quiz.answer = a;
         return quiz;
       });
     });
   })
   .then(quiz => {
     return quiz.save();
   })
   .then(quiz => {
     log(` Se ha cambiado el quiz ${colorize(quiz.id, 'magenta')} por: ${quiz.question} ${colorize('=>', 'magenta')} ${quiz.answer}`);
   })
   .catch(Sequelize.ValidationError, error => {
      errorlog('El quiz es erroneo:');
      error.errors.forEach(({message}) => errorlog(message));
    })
    .catch(error => {
      errorlog(error.message);
    })
    .then(() => {
      rl.prompt();
    });
};

exports.credits = rl => {
    log('Autor de la práctica:', 'green');
    log('Martin Collado', 'green');
    rl.prompt();
};

exports.quitCmd = rl => {
    rl.close();
};


