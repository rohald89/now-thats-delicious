import axios from 'axios';
import { $ } from './bling';

function ajaxHeart(e) {
    e.preventDefault();
    axios
        .post(this.action)   // this is the clicked form (the heart) and the action 
        .then(res => {
            const isHearted = this.heart.classList.toggle('heart__button--hearted');  // this is the clicked heart (form) the `.heart` selects the child element that has a name attribute with that value. which in this case is the button
            $('.heart-count').textContent = res.data.hearts.length;  // update the number in the header when a heart is added or removed
            if(isHearted) {
                this.heart.classList.add('heart__button--float');
                setTimeout(() => this.heart.classList.remove('heart__button--float'), 2500)
            }
        })
        .catch(console.error)
    }

export default ajaxHeart