import { Routes } from '@angular/router';
import {GolfComponent} from './golf/golf.component';
import {GolfShotComponent} from './golf-shot/golf-shot.component';
import {RoundComponent} from './round/round.component';
import {GolfBagComponent} from './golf-bag/golf-bag.component';
import {GolfClubComponent} from './golf-club/golf-club.component';
import {LoginComponent} from './login/login.component';
import { AuthGuard } from './guards/auth.guard';
import {BlogComponent} from './blog/blog.component';
import { RegisterComponent } from './register/register.component';
import { ProfileComponent } from './profile/profile.component';
import { CreateGolfBagComponent } from './create-golf-bag/create-golf-bag.component';

export const routes: Routes = [
    
    // Individual Components
    { path: 'golf-component', component: GolfComponent,},
    { path: 'golf-shot-component', component: GolfShotComponent,},
    { path: 'blog-component', component: BlogComponent },
    { path: 'round-component', component: RoundComponent,},
    { path: 'golf-bag-component', component: GolfBagComponent,},
    { path: 'new-bag', component: CreateGolfBagComponent,},
    {path: 'golf-club-component', component: GolfClubComponent,},
    { path: 'dashboard', component: GolfComponent, canActivate: [AuthGuard] },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'profile', component: ProfileComponent },

    { path: 'blog-component/golf-component', redirectTo: 'golf-component'},
    { path: 'golf-shot-component/golf-component', redirectTo: 'golf-component'},
    { path: 'golf-component/golf-shot-component', redirectTo: 'golf-shot-component'},
    { path: 'golf-component/round-component', redirectTo: 'round-component'},
    { path: 'golf-component/blog-component', redirectTo: 'blog-component'},
    { path: '*/login-component', redirectTo: 'login-component'},

    { path: 'golf-bag/:id', component: GolfBagComponent}
];
