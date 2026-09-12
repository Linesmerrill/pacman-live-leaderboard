import streamDeck from '@elgato/streamdeck';
import { createActions, refreshKeys } from './actions.ts';
import { gameClient } from './client.ts';

// One action per game command, plus the configurable key and the status tile.
for (const action of createActions()) streamDeck.actions.registerAction(action);

// Repaint the keys whenever the game state changes, and once a second so the
// POWER MODE and run countdowns on the keys stay honest.
gameClient.onChange(() => void refreshKeys());
setInterval(() => {
  const state = gameClient.status?.state;
  if (state === 'power-mode' || state === 'playing' || state === 'countdown') void refreshKeys();
}, 1000);

// No top-level await: the bundle runs from the installed plugin folder.
void streamDeck.connect().then(() => {
  streamDeck.logger.info('Pac-Man Maze controller connected to Stream Deck.');
  gameClient.configure();
});
