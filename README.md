1. Setup Endpoint Url, WS Endpoint URL
![endpoint setup](https://github.com/neohb/wincc-unified-nodes/assets/117887785/901912ee-7231-4111-a7fe-39624189036a)
2. Create Signed CA Cert via Wincc Certificate manager, manually export to your .nodered folder
![Self sign CA setup 0](https://github.com/neohb/wincc-unified-nodes/assets/117887785/7ff280f4-e0c4-4bae-98d8-b59176d0f107)
![Self sign CA setup 0 1](https://github.com/neohb/wincc-unified-nodes/assets/117887785/c23d3d73-ce6e-458c-8473-ed8c6cf10c19)
3. After you manually export the CA Cert to your .nodered folder, you must again navigate to the same folder and click on the CA cert for name identification
![Self sign CA setup 1](https://github.com/neohb/wincc-unified-nodes/assets/117887785/e640dead-f96f-443e-8870-a84513170f03)
4. In each flow u can only use 1 Unified login node to connect to 1 Unified server, if multiple server please create on another flow page. 
![Unified GraphQL user login](https://github.com/neohb/wincc-unified-nodes/assets/117887785/5a87b2f9-e51c-4040-83e4-e08f11a386d7)
5. The Unified Login Username and Password is defined in Wincc Unified TIA portal and use must be added to Graphql Read Write Rights roles
![Unified GraphQL user login setup](https://github.com/neohb/wincc-unified-nodes/assets/117887785/f3ee398b-ff62-4398-b0bc-3b5b2c0947b4)
6. To Read a Tag Value
![Read Tag](https://github.com/neohb/wincc-unified-nodes/assets/117887785/a9f5888f-cd07-4796-9707-0b64a8fbe1d9)
7. Write a Fixed Value to Tag
![Write fix value](https://github.com/neohb/wincc-unified-nodes/assets/117887785/c77ed523-6aea-4f94-a1c0-3957613b9579)
8. Write a Variable value from nodered to Tag
![Write variable value from node red](https://github.com/neohb/wincc-unified-nodes/assets/117887785/5382a587-c742-4a55-a403-03364858a3eb)
![Write variable value from node red 2](https://github.com/neohb/wincc-unified-nodes/assets/117887785/dcf14dda-79c2-473e-940b-fc5eccbb260d)
9. Subscribe to a Tag Value
![subcribe to tagvalue](https://github.com/neohb/wincc-unified-nodes/assets/117887785/f77b34f0-b37d-4855-8357-262e0226ee6c)
10. Subcribe to Alarm ID, output 1 give alarm State (Raised,Went,Acknowlegde ...etc), output 2 give the value.
![subcribe to alarm id](https://github.com/neohb/wincc-unified-nodes/assets/117887785/364defa2-5971-407c-810b-322fcd01e559)
 
## Disclaimer

The WINCC Unified Nodes software is provided "as is," without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and non-infringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.    

## Acknowledgments

This project includes code from the following sources:

- [node-red-contrib-graphql](https://github.com/rgstephens/node-red-contrib-graphql.git): Adapted GraphQL Query and Mutation functionality to fit Wincc unified GraphQL Server requirements.

- [jetblack-graphql-client](https://github.com/rob-blackbourn/jetblack-graphql-client/blob/master/src/Subscriber.js): Utilized for the websocket subscribe functionality.

- [special thanks] (https://github.com/vogler75?tab=repositories): kick starting ideas and flow concept

We are grateful to the contributors of these projects for their valuable contributions.


